CREATE TABLE `kb_sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_url` text,
	`bundle_version` text,
	`bundle_sha256` text,
	`checked_at` integer,
	`imported_at` integer
);
--> statement-breakpoint
ALTER TABLE `routines` ADD `kb_id` text;--> statement-breakpoint
ALTER TABLE `routines` ADD `kb_version` text;--> statement-breakpoint
CREATE UNIQUE INDEX `routines_kb_id_unique` ON `routines` (`kb_id`);