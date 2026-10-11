CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`primary_muscles` text DEFAULT '[]' NOT NULL,
	`equipment` text DEFAULT '[]' NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`kb_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_kb_id_unique` ON `exercises` (`kb_id`);--> statement-breakpoint
CREATE INDEX `exercises_updated_at_idx` ON `exercises` (`updated_at`);--> statement-breakpoint
CREATE INDEX `exercises_deleted_at_idx` ON `exercises` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `workouts_updated_at_idx` ON `workouts` (`updated_at`);--> statement-breakpoint
CREATE INDEX `workouts_deleted_at_idx` ON `workouts` (`deleted_at`);