ALTER TABLE "tasks" ADD COLUMN "repeat" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_repeat_check" CHECK (repeat in ('daily', 'weekly', 'monthly'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_repeat_needs_due_date_check" CHECK ("tasks"."repeat" is null or "tasks"."due_date" is not null);