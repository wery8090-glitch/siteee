-- Realtime delivery for the support inbox. Safe to run repeatedly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
END $$;

ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS support_tickets_realtime_select ON public.support_tickets;
CREATE POLICY support_tickets_realtime_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    user_open_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.open_id = auth.uid() AND p.role IN ('owner', 'developer', 'admin', 'support', 'media', 'moderator') AND p.status = 'active'
    )
  );

DROP POLICY IF EXISTS support_messages_realtime_select ON public.support_messages;
CREATE POLICY support_messages_realtime_select ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND (
        t.user_open_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.open_id = auth.uid() AND p.role IN ('owner', 'developer', 'admin', 'support', 'media', 'moderator') AND p.status = 'active'
        )
      )
    )
  );
