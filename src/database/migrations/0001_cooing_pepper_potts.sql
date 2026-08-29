CREATE TABLE IF NOT EXISTS `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'cash' NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`icon` text DEFAULT 'wallet-outline' NOT NULL,
	`color` text DEFAULT '#000000' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `account_id` text REFERENCES accounts(id);--> statement-breakpoint
ALTER TABLE `transactions` ADD `transfer_to_account_id` text REFERENCES accounts(id);--> statement-breakpoint
CREATE INDEX `idx_transactions_account` ON `transactions` (`account_id`);