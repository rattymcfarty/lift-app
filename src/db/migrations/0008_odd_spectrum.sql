CREATE TABLE `cardio_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`minutes` integer NOT NULL,
	`activity` text,
	`logged_at` integer NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `cardio_logs_logged_at_idx` ON `cardio_logs` (`logged_at`);--> statement-breakpoint
CREATE INDEX `cardio_logs_updated_at_idx` ON `cardio_logs` (`updated_at`);--> statement-breakpoint
CREATE INDEX `cardio_logs_deleted_at_idx` ON `cardio_logs` (`deleted_at`);