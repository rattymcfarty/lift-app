CREATE TABLE `program_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`program_id` text NOT NULL,
	`program_kb_id` text,
	`kb_version` text,
	`snapshot` text NOT NULL,
	`enrolled_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`current_week` integer DEFAULT 1 NOT NULL,
	`current_day` integer DEFAULT 1 NOT NULL,
	`longevity_pillars` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `program_enrollments_status_idx` ON `program_enrollments` (`status`);--> statement-breakpoint
CREATE INDEX `program_enrollments_program_id_idx` ON `program_enrollments` (`program_id`);--> statement-breakpoint
CREATE INDEX `program_enrollments_updated_at_idx` ON `program_enrollments` (`updated_at`);--> statement-breakpoint
CREATE INDEX `program_enrollments_deleted_at_idx` ON `program_enrollments` (`deleted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `program_enrollments_active_program_unique` ON `program_enrollments` (`program_id`) WHERE "program_enrollments"."status" = 'active' and "program_enrollments"."deleted_at" is null;