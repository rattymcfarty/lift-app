CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`type` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`measured_at` integer NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `measurements_type_measured_at_idx` ON `measurements` (`type`,`measured_at`);--> statement-breakpoint
CREATE INDEX `measurements_updated_at_idx` ON `measurements` (`updated_at`);--> statement-breakpoint
CREATE INDEX `measurements_deleted_at_idx` ON `measurements` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `personal_records` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`exercise_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`achieved_at` integer NOT NULL,
	`workout_id` text,
	`set_id` text,
	`previous_value` real,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`set_id`) REFERENCES `sets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `personal_records_exercise_kind_idx` ON `personal_records` (`exercise_id`,`kind`);--> statement-breakpoint
CREATE INDEX `personal_records_exercise_achieved_idx` ON `personal_records` (`exercise_id`,`achieved_at`);--> statement-breakpoint
CREATE INDEX `personal_records_updated_at_idx` ON `personal_records` (`updated_at`);--> statement-breakpoint
CREATE INDEX `personal_records_deleted_at_idx` ON `personal_records` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `routine_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`routine_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`target_sets` integer,
	`target_reps` text,
	`target_weight_kg` real,
	`target_rpe` real,
	`target_rest_seconds` integer,
	`notes` text,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `routine_exercises_routine_id_idx` ON `routine_exercises` (`routine_id`);--> statement-breakpoint
CREATE INDEX `routine_exercises_routine_position_idx` ON `routine_exercises` (`routine_id`,`position`);--> statement-breakpoint
CREATE INDEX `routine_exercises_updated_at_idx` ON `routine_exercises` (`updated_at`);--> statement-breakpoint
CREATE INDEX `routine_exercises_deleted_at_idx` ON `routine_exercises` (`deleted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `routine_exercises_routine_position_unique` ON `routine_exercises` (`routine_id`,`position`) WHERE "routine_exercises"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`notes` text,
	`estimated_minutes` integer,
	`longevity_pillars` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `routines_updated_at_idx` ON `routines` (`updated_at`);--> statement-breakpoint
CREATE INDEX `routines_deleted_at_idx` ON `routines` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `sets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`workout_exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`rpe` real,
	`rir` integer,
	`duration_seconds` integer,
	`distance_m` real,
	`completed` integer DEFAULT true NOT NULL,
	`notes` text,
	FOREIGN KEY (`workout_exercise_id`) REFERENCES `workout_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sets_workout_exercise_id_idx` ON `sets` (`workout_exercise_id`);--> statement-breakpoint
CREATE INDEX `sets_workout_exercise_set_idx` ON `sets` (`workout_exercise_id`,`set_number`);--> statement-breakpoint
CREATE INDEX `sets_updated_at_idx` ON `sets` (`updated_at`);--> statement-breakpoint
CREATE INDEX `sets_deleted_at_idx` ON `sets` (`deleted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sets_workout_exercise_set_unique` ON `sets` (`workout_exercise_id`,`set_number`) WHERE "sets"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`notes` text,
	`rest_seconds` integer,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workout_exercises_workout_id_idx` ON `workout_exercises` (`workout_id`);--> statement-breakpoint
CREATE INDEX `workout_exercises_workout_position_idx` ON `workout_exercises` (`workout_id`,`position`);--> statement-breakpoint
CREATE INDEX `workout_exercises_exercise_id_idx` ON `workout_exercises` (`exercise_id`);--> statement-breakpoint
CREATE INDEX `workout_exercises_updated_at_idx` ON `workout_exercises` (`updated_at`);--> statement-breakpoint
CREATE INDEX `workout_exercises_deleted_at_idx` ON `workout_exercises` (`deleted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `workout_exercises_workout_position_unique` ON `workout_exercises` (`workout_id`,`position`) WHERE "workout_exercises"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE `exercises` ADD `secondary_muscles` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `category` text DEFAULT 'strength' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `instructions` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `media_image_url` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `media_video_url` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `longevity_pillars` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `kb_version` text;--> statement-breakpoint
CREATE INDEX `exercises_category_idx` ON `exercises` (`category`);--> statement-breakpoint
CREATE INDEX `exercises_is_custom_idx` ON `exercises` (`is_custom`);--> statement-breakpoint
ALTER TABLE `workouts` ADD `longevity_pillars` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `routine_id` text REFERENCES routines(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `workouts_started_at_idx` ON `workouts` (`started_at`);