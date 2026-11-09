ALTER TABLE `comments` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `channels` ADD `moderate_replies_since` text;--> statement-breakpoint
ALTER TABLE `channels` ADD `reply_sweep_boundary` text;--> statement-breakpoint
ALTER TABLE `channels` ADD `reply_sweep_page_token` text;--> statement-breakpoint
ALTER TABLE `channels` ADD `reply_sweep_last_at` text;--> statement-breakpoint
ALTER TABLE `channels` ADD `reply_sweep_shortfall` integer;