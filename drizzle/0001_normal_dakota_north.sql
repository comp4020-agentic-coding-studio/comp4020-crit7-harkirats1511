CREATE TABLE `activity_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`exempt_from_clash` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `allocations` (
	`student_id` text NOT NULL,
	`group_id` text NOT NULL,
	`option_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`student_id`, `group_id`)
);
--> statement-breakpoint
CREATE TABLE `course_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` text NOT NULL,
	`code` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_aliases_course_id_code_unique` ON `course_aliases` (`course_id`,`code`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`term_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `draft_allocations` (
	`draft_id` text NOT NULL,
	`group_id` text NOT NULL,
	`option_id` text,
	PRIMARY KEY(`draft_id`, `group_id`)
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`group_id` text NOT NULL,
	`from_option_id` text,
	`to_option_id` text,
	`source` text NOT NULL,
	`undoes_batch_id` text,
	`undone_by_batch_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `options` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`code` text NOT NULL,
	`capacity` integer,
	`campus` text,
	`staff` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`student_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`option_id` text NOT NULL,
	`part` text DEFAULT 'P1' NOT NULL,
	`day` integer NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`weeks` integer NOT NULL,
	`location` text
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `swap_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` text NOT NULL,
	`group_id` text NOT NULL,
	`have_option_id` text NOT NULL,
	`want_option_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `terms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`teaching_weeks` integer DEFAULT 13 NOT NULL,
	`break_after_week` integer
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` text NOT NULL,
	`option_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_student_id_option_id_unique` ON `waitlist` (`student_id`,`option_id`);--> statement-breakpoint
DROP TABLE `messages`;