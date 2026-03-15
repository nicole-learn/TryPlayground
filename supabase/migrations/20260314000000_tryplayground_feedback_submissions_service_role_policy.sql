create policy "feedback_submissions_service_role_all"
on public.feedback_submissions
for all
to service_role
using (true)
with check (true);
