CREATE TABLE "Topic" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp(6) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cover" text,
	"startTime" timestamp,
	"endTime" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"expected" bigint DEFAULT 0 NOT NULL,
	"accepted" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "topicId" integer;