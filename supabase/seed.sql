-- Run ONCE in the Supabase SQL editor to create your school and first administrator.
-- 1) Dashboard > Authentication > Users > Add user (email + password). Copy the new user's UUID.
-- 2) Replace the placeholders below and run this script.

with s as (
  insert into schools (name, slug) values ('Your School Name', 'your-school') returning id
)
insert into profiles (id, school_id, role, full_name, email)
select '00000000-0000-0000-0000-000000000000'::uuid,   -- <- the admin's auth user UUID
       s.id, 'admin', 'Admin Name', 'admin@yourschool.com'
from s;
