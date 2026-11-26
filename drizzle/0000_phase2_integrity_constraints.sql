CREATE TABLE "matter_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matter_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"author_id" uuid,
	"update_type" text DEFAULT 'note' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"created_by" uuid,
	"owner_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"priority" text DEFAULT 'Normal' NOT NULL,
	"waiting_for" text,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "chk_matters_status" CHECK ("matters"."status" IN ('Open', 'In Progress', 'Waiting', 'Completed', 'Archived')),
	CONSTRAINT "chk_matters_priority" CHECK ("matters"."priority" IN ('Low', 'Normal', 'High'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"matter_id" uuid,
	"message" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_space_memberships_role" CHECK ("space_memberships"."role" IN ('owner', 'admin', 'member'))
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_spaces_type" CHECK ("spaces"."type" IN ('personal', 'family', 'community'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uid" text,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "matter_participants" ADD CONSTRAINT "matter_participants_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_participants" ADD CONSTRAINT "matter_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_updates" ADD CONSTRAINT "matter_updates_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_updates" ADD CONSTRAINT "matter_updates_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matters" ADD CONSTRAINT "matters_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matters" ADD CONSTRAINT "matters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matters" ADD CONSTRAINT "matters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_memberships" ADD CONSTRAINT "space_memberships_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_memberships" ADD CONSTRAINT "space_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_matter_participants_matter_user" ON "matter_participants" USING btree ("matter_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_matter_participants_user_id" ON "matter_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_matter_updates_matter_id" ON "matter_updates" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "idx_matter_updates_created_at" ON "matter_updates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_matters_space_id" ON "matters" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_matters_owner_id" ON "matters" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_matters_status" ON "matters" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_matters_next_action_at" ON "matters" USING btree ("next_action_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_read_at" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_space_memberships_space_user" ON "space_memberships" USING btree ("space_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_space_memberships_user_id" ON "space_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_spaces_created_by" ON "spaces" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_spaces_personal_owner" ON "spaces" USING btree ("created_by") WHERE "spaces"."type" = 'personal';