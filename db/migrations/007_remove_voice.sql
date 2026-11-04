-- Owner removed voice from the product before deployment. Preserve migration history.
ALTER TABLE ai_preferences DROP COLUMN voice_enabled;
