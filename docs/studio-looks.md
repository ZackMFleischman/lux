# Saved looks

Open **File → Looks…**. Enter a name and choose **Save as new**. The look stores the working preview's source, assets, manual controls, animation bindings, and resolution. Build source edits first if you want them in the look. A failed draft is not saved over the working source.

Select a row to update that named look. **Update** is separate from saving a new look. **Load** recalls the source and controls together. Lux asks before discarding unsaved changes. A failed load keeps the previous source and preview.

Looks are private to the Studio profile. They contain frozen component source. Library updates do not change a saved look. This version supports 128 looks, each at most 8 MiB, at 60 fps and seed 0. Animation bindings are recalled from their start phase. Thumbnails are optional.

Storage writes a temporary file, syncs it, then renames it over the selected record. A failed write keeps the previous record. The directory is not flushed after rename on Windows, so power-loss durability is not guaranteed. A damaged record does not hide the other looks. Normal scene files and layouts remain separate.
