// GENERATED — do not edit. Rebuilt by scripts/bundle-migrations.mjs
export default {
  journal: {"version":"7","dialect":"sqlite","entries":[{"idx":0,"version":"6","when":1791731140994,"tag":"0000_busy_hardball","breakpoints":true}]},
  migrations: {
    "0000_busy_hardball": "CREATE TABLE `exercises` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`created_at` integer NOT NULL,\n\t`updated_at` integer NOT NULL,\n\t`deleted_at` integer,\n\t`name` text NOT NULL,\n\t`primary_muscles` text DEFAULT '[]' NOT NULL,\n\t`equipment` text DEFAULT '[]' NOT NULL,\n\t`is_custom` integer DEFAULT false NOT NULL,\n\t`kb_id` text\n);\n--> statement-breakpoint\nCREATE TABLE `workouts` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`created_at` integer NOT NULL,\n\t`updated_at` integer NOT NULL,\n\t`deleted_at` integer,\n\t`name` text NOT NULL,\n\t`started_at` integer NOT NULL,\n\t`ended_at` integer,\n\t`notes` text\n);\n"
  },
};
