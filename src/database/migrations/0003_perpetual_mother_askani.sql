CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`category_id` text,
	`account_id` text,
	`due_date` text NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`note` text,
	`is_paid` integer DEFAULT 0 NOT NULL,
	`paid_date` text,
	`auto_create_transaction` integer DEFAULT 1 NOT NULL,
	`transaction_id` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`reminder_days_before` integer DEFAULT 1 NOT NULL,
	`recurring_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `bill_id` text REFERENCES bills(id);