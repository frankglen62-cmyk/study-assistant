set search_path = public, extensions;

update public.payment_packages
   set currency = 'PHP',
       updated_at = now()
 where code in ('one-hour', 'three-hours', 'five-hours', 'ten-hours')
   and currency = 'USD';
