CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`person_name` text NOT NULL,
	`type` text NOT NULL,
	`total_amount` integer NOT NULL,
	`remaining_amount` integer NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`account_id` text REFERENCES `accounts`(`id`),
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE TABLE `debt_repayments` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL REFERENCES `debts`(`id`) ON DELETE cascade,
	`amount` integer NOT NULL,
	`payment_date` text NOT NULL,
	`account_id` text REFERENCES `accounts`(`id`),
	`note` text,
	`transaction_id` text REFERENCES `transactions`(`id`),
	`created_at` text NOT NULL
);
