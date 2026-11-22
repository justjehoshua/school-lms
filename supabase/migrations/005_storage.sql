-- 005: private bucket for lesson images. Path convention:  <school_id>/<lesson_id>/<filename>
-- The app serves images with short-lived signed URLs, so a pasted link stops working after it expires.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-images', 'lesson-images', false, 5242880,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function storage_lesson_id(p_name text) returns uuid
language sql immutable as $$
  select case when (storage.foldername(p_name))[2] ~ '^[0-9a-f-]{36}$'
              then ((storage.foldername(p_name))[2])::uuid end
$$;

create policy lesson_images_read on storage.objects for select to authenticated
  using (bucket_id = 'lesson-images' and can_read_lesson(storage_lesson_id(name)));

create policy lesson_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-images' and can_manage_lesson(storage_lesson_id(name))
              and (storage.foldername(name))[1] = current_school_id()::text);

create policy lesson_images_update on storage.objects for update to authenticated
  using (bucket_id = 'lesson-images' and can_manage_lesson(storage_lesson_id(name)));

create policy lesson_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-images' and can_manage_lesson(storage_lesson_id(name)));
