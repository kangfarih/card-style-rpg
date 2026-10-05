class_name WindhillSave
extends RefCounted
## Replaces localStorage windhill-config / windhill-progress with user://windhill.cfg.

const PATH := "user://windhill.cfg"

static func load_config(defaults: Dictionary) -> Dictionary:
	var cfg := ConfigFile.new()
	var out := defaults.duplicate()
	if cfg.load(PATH) != OK:
		return out
	for k in defaults.keys():
		if cfg.has_section_key("config", k):
			out[k] = cfg.get_value("config", k)
	return out

static func save_config(config: Dictionary) -> void:
	var cfg := ConfigFile.new()
	(cfg.load(PATH))
	for k in config.keys():
		cfg.set_value("config", k, config[k])
	cfg.save(PATH)

static func load_progress(defaults: Dictionary) -> Dictionary:
	var cfg := ConfigFile.new()
	var out := defaults.duplicate()
	if cfg.load(PATH) != OK:
		return out
	for k in defaults.keys():
		if cfg.has_section_key("progress", k):
			out[k] = cfg.get_value("progress", k)
	return out

static func save_progress(progress: Dictionary) -> void:
	var cfg := ConfigFile.new()
	(cfg.load(PATH))
	for k in progress.keys():
		cfg.set_value("progress", k, progress[k])
	cfg.save(PATH)
