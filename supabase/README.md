# Supabase

The initial schema is in `migrations/20261112224500_initial_schema.sql`. It creates an empty Zippy organization, relational inventory and purchasing tables, and restrictive row-level security policies. It does not import browser `localStorage` data or create users.

## Apply to the test project

1. Rotate the database password in Supabase if it was exposed, and store the replacement in a password manager.
2. Open the Zippy test project, then **SQL Editor**.
3. Paste and run the initial migration from the file above.
4. Confirm the migration succeeded and that every public application table has RLS enabled. Do not enable automatic table exposure or grant anonymous access.
5. In **Authentication** settings, disable public sign-ups. Invite the initial administrator from the dashboard.
6. In SQL Editor, create that invited user's profile as the first administrator, replacing the UUID with the invited user's Auth user ID:

   ```sql
   insert into public.profiles (user_id, organization_id, display_name, role)
   values (
     'AUTH_USER_UUID',
     '00000000-0000-0000-0000-000000000001',
     'Administrator',
     'admin'
   );
   ```

7. Invite subsequent users and assign their role and, for employees, sector with `public.admin_set_profile(...)`.

The UI still uses browser-local state and simulated roles at this stage. Do not add Supabase credentials to the app or run operational tests against this database until the UI is migrated to Supabase Auth and its operations are covered by database-backed tests. The browser-safe project URL and publishable key may be configured in Vercel only after that integration; never expose a database password, secret key, or `service_role` key in client code.
