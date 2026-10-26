CREATE INDEX `documents_kind_owner_updated` ON `documents` (`kind`,`owner`,`updated`);--> statement-breakpoint
CREATE INDEX `events_subject_at` ON `events` (`subject`,`at`);