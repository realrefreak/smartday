ALTER TABLE "tasks" ADD COLUMN "priority" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "notes" varchar(1000);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_check" CHECK (priority in ('high', 'medium', 'low'));