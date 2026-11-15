"use client";

import { useState } from "react";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { FeedbackList, type StudentFeedbackItem } from "@/components/feedback/feedback-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function FeedbackHub({
  student,
  items,
}: {
  student: { name: string; rollNumber: string; email: string; canSubmit: boolean };
  items: StudentFeedbackItem[];
}) {
  const [tab, setTab] = useState("new");
  const awaiting = items.filter((item) => !item.resolved).length;

  return (
    <div className="module-page !max-w-[1280px]">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Support</span>
          <h1>Feedback or query</h1>
          <p>Send a question, suggestion, or complaint to the placement team and track their replies.</p>
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab} className="mt-5 gap-4">
        <TabsList>
          <TabsTrigger value="new">New message</TabsTrigger>
          <TabsTrigger value="history">
            My messages ({items.length}
            {awaiting ? ` · ${awaiting} awaiting` : ""})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <FeedbackForm student={student} onViewHistory={() => setTab("history")} />
        </TabsContent>
        <TabsContent value="history">
          <FeedbackList items={items} onNew={() => setTab("new")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
