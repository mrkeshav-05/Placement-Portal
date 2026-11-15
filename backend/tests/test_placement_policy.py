"""The one-offer placement policy: who may still apply to which drive."""
from __future__ import annotations


from app.models.db import JobType, OfferStatus, OfferType, PpoStatus
from app.services.placement_policy import (
    BTECH_DREAM_THRESHOLD,
    POSTGRAD_DREAM_THRESHOLD,
    PolicyJob,
    PolicyOffer,
    Standing,
    dream_threshold,
    is_dream_drive,
    is_dream_offer,
    placement_standing,
    policy_allows,
)

BTECH = "B.Tech"
BT = BTECH_DREAM_THRESHOLD


def offer(
    type_=OfferType.FTE,
    ctc=None,
    status=OfferStatus.ACCEPTED,
    category=None,
    ppo=PpoStatus.PENDING,
    company="Acme",
):
    return PolicyOffer(
        type=type_,
        status=status,
        ctc=ctc,
        company_name=company,
        company_category=category,
        ppo_status=ppo,
    )


def job(type_=JobType.FTE, package=None, category=None):
    return PolicyJob(type=type_, package=package, company_category=category)


DREAM_FTE = job(package=2_000_000)
FIRST_ROUND_FTE = job(package=800_000)
INTERN_DRIVE = job(JobType.INTERNSHIP, package=50_000)


def test_no_offers_is_open_to_everything():
    result = placement_standing([], BTECH)
    assert result.standing == Standing.OPEN
    for drive in (DREAM_FTE, FIRST_ROUND_FTE, INTERN_DRIVE):
        assert policy_allows(result, drive) == (True, None)


def test_dream_line_follows_the_programme():
    assert dream_threshold("B.Tech") == 1_000_000
    for degree in ("M.Tech", "m tech", "M.Sc.", "MSc", "MBA", "Ph.D.", "PhD"):
        assert dream_threshold(degree) == 800_000, degree
    # An unset or unrecognised degree is read as B.Tech, the higher line.
    assert dream_threshold(None) == 1_000_000
    assert dream_threshold("Dual Degree") == 1_000_000


def test_line_is_inclusive_10_lpa_for_btech_8_lpa_for_postgrad():
    assert is_dream_offer(offer(ctc=1_000_000), BTECH_DREAM_THRESHOLD)
    assert not is_dream_offer(offer(ctc=999_999), BTECH_DREAM_THRESHOLD)
    assert is_dream_offer(offer(ctc=800_000), POSTGRAD_DREAM_THRESHOLD)
    assert not is_dream_offer(offer(ctc=799_999), POSTGRAD_DREAM_THRESHOLD)
    assert is_dream_drive(job(package=1_000_000), BTECH_DREAM_THRESHOLD)


def test_the_same_9_lpa_offer_is_first_round_for_btech_and_dream_for_mtech():
    nine = [offer(ctc=900_000)]
    assert placement_standing(nine, "B.Tech").standing == Standing.FIRST_ROUND_PLACED
    assert placement_standing(nine, "M.Tech").standing == Standing.DREAM_PLACED


def test_the_same_9_lpa_drive_is_open_to_a_first_round_mtech_but_not_btech():
    nine_lpa_drive = job(package=900_000)
    btech = placement_standing([offer(ctc=700_000)], "B.Tech")
    mtech = placement_standing([offer(ctc=700_000)], "M.Tech")
    assert not policy_allows(btech, nine_lpa_drive)[0]
    assert policy_allows(mtech, nine_lpa_drive)[0]


def test_dream_offer_closes_every_drive():
    result = placement_standing([offer(ctc=1_500_000)], BTECH)
    assert result.standing == Standing.DREAM_PLACED
    for drive in (DREAM_FTE, FIRST_ROUND_FTE, INTERN_DRIVE):
        allowed, reason = policy_allows(result, drive)
        assert not allowed
        assert "Dream offer" in reason


def test_dream_ppo_counts_as_dream():
    result = placement_standing([offer(OfferType.PPO, ctc=1_800_000)], BTECH)
    assert result.standing == Standing.DREAM_PLACED


def test_first_round_offer_leaves_only_dream_drives():
    result = placement_standing([offer(ctc=900_000)], BTECH)
    assert result.standing == Standing.FIRST_ROUND_PLACED
    assert policy_allows(result, DREAM_FTE)[0]
    assert not policy_allows(result, FIRST_ROUND_FTE)[0]
    allowed, reason = policy_allows(result, INTERN_DRIVE)
    assert not allowed and "Internship drives" in reason


def test_internship_drive_is_never_dream_even_with_dream_company():
    assert not is_dream_drive(job(JobType.INTERNSHIP, package=None, category="Dream"), BT)


def test_company_category_marks_a_drive_dream():
    assert is_dream_drive(job(JobType.INTERNSHIP_PPO, package=80_000, category="Dream"), BT)
    assert not is_dream_drive(job(JobType.INTERNSHIP_FTE, package=80_000, category="First Round"), BT)


def test_offer_without_ctc_falls_back_to_company_category():
    assert is_dream_offer(offer(ctc=None, category="Dream"), BT)
    assert not is_dream_offer(offer(ctc=None, category="First Round"), BT)
    # A figure on file decides on its own, whatever the label says.
    assert not is_dream_offer(offer(ctc=600_000, category="Dream"), BT)


def test_declined_and_revoked_offers_do_not_count():
    offers = [
        offer(ctc=2_000_000, status=OfferStatus.DECLINED),
        offer(ctc=900_000, status=OfferStatus.REVOKED),
    ]
    assert placement_standing(offers, BTECH).standing == Standing.OPEN


def test_an_internship_blocks_every_drive_until_its_ppo_outcome_is_recorded():
    result = placement_standing([offer(OfferType.INTERNSHIP)], BTECH)
    assert result.standing == Standing.INTERNING
    for drive in (DREAM_FTE, FIRST_ROUND_FTE, INTERN_DRIVE):
        assert not policy_allows(result, drive)[0]


def test_a_finished_internship_still_blocks_while_the_ppo_is_pending():
    # Time passing changes nothing: only the recorded outcome does.
    assert placement_standing([offer(OfferType.INTERNSHIP, ppo=PpoStatus.PENDING)], BTECH).standing == Standing.INTERNING


def test_no_ppo_puts_the_student_back_in_the_pool():
    no_ppo = offer(OfferType.INTERNSHIP, ppo=PpoStatus.NOT_RECEIVED)
    result = placement_standing([no_ppo], BTECH)
    assert result.standing == Standing.OPEN
    for drive in (DREAM_FTE, FIRST_ROUND_FTE, INTERN_DRIVE):
        assert policy_allows(result, drive)[0]


def test_a_received_ppo_is_judged_as_the_ppo_offer():
    internship = offer(OfferType.INTERNSHIP, ppo=PpoStatus.RECEIVED)
    dream_ppo = offer(OfferType.PPO, ctc=1_400_000)
    assert placement_standing([internship, dream_ppo], BTECH).standing == Standing.DREAM_PLACED
    first_round_ppo = offer(OfferType.PPO, ctc=700_000)
    assert placement_standing([internship, first_round_ppo], BTECH).standing == Standing.FIRST_ROUND_PLACED


def test_a_pending_internship_beats_a_first_round_offer():
    offers = [offer(ctc=900_000), offer(OfferType.INTERNSHIP)]
    result = placement_standing(offers, BTECH)
    assert result.standing == Standing.INTERNING
    assert not policy_allows(result, DREAM_FTE)[0]


def test_a_dream_offer_beats_a_pending_internship():
    offers = [offer(OfferType.INTERNSHIP), offer(ctc=2_000_000)]
    assert placement_standing(offers, BTECH).standing == Standing.DREAM_PLACED


def test_a_revoked_internship_does_not_block():
    revoked = offer(OfferType.INTERNSHIP, status=OfferStatus.REVOKED)
    assert placement_standing([revoked], BTECH).standing == Standing.OPEN


def test_dream_beats_first_round_and_names_the_best_offer():
    offers = [offer(ctc=900_000, company="Small"), offer(ctc=2_500_000, company="Big")]
    result = placement_standing(offers, BTECH)
    assert result.standing == Standing.DREAM_PLACED
    assert result.company_name == "Big"
