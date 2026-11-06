CREATE TABLE "reminder_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"hour" integer DEFAULT 8 NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"last_sent_on" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_settings_hour_check" CHECK ("reminder_settings"."hour" between 0 and 23)
);
--> statement-breakpoint
ALTER TABLE "reminder_settings" ADD CONSTRAINT "reminder_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;