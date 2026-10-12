CREATE TABLE `parq_screenings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`completed_at` integer NOT NULL,
	`any_yes` integer DEFAULT false NOT NULL,
	`answers_json` text DEFAULT '[]' NOT NULL,
	`clearance_acknowledged_at` integer
);
--> statement-breakpoint
CREATE INDEX `parq_screenings_completed_at_idx` ON `parq_screenings` (`completed_at`);--> statement-breakpoint
CREATE INDEX `parq_screenings_deleted_at_idx` ON `parq_screenings` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `parq_screenings_updated_at_idx` ON `parq_screenings` (`updated_at`);--> statement-breakpoint
CREATE TABLE `program_session_states` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`enrollment_id` text NOT NULL,
	`week` integer NOT NULL,
	`day` integer NOT NULL,
	`routine_kb_id` text NOT NULL,
	`scheduled_date` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`workout_id` text,
	`resolved_at` integer,
	FOREIGN KEY (`enrollment_id`) REFERENCES `program_enrollments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `program_session_states_enrollment_idx` ON `program_session_states` (`enrollment_id`);--> statement-breakpoint
CREATE INDEX `program_session_states_status_idx` ON `program_session_states` (`status`);--> statement-breakpoint
CREATE INDEX `program_session_states_scheduled_date_idx` ON `program_session_states` (`scheduled_date`);--> statement-breakpoint
CREATE INDEX `program_session_states_deleted_at_idx` ON `program_session_states` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `program_session_states_updated_at_idx` ON `program_session_states` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `program_session_states_enrollment_week_day_unique` ON `program_session_states` (`enrollment_id`,`week`,`day`) WHERE "program_session_states"."deleted_at" is null;