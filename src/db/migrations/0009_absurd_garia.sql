ALTER TABLE `sets` ADD `is_warmup` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD `unit_preference` text;--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD `superset_id` text;--> statement-breakpoint
CREATE INDEX `workout_exercises_superset_id_idx` ON `workout_exercises` (`superset_id`);