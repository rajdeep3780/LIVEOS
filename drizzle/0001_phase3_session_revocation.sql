CREATE TABLE "revoked_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jti" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revoked_sessions_jti_unique" UNIQUE("jti")
);
--> statement-breakpoint
ALTER TABLE "revoked_sessions" ADD CONSTRAINT "revoked_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_revoked_sessions_expires_at" ON "revoked_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_revoked_sessions_user_id" ON "revoked_sessions" USING btree ("user_id");