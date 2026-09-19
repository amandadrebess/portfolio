-- =====================================================================
-- importar-meus-videos.sql | OPCIONAL
--
-- Coloca no painel os 10 vídeos que já estão no seu portfólio, para você
-- poder editar, esconder e reordenar cada um. Só rode DEPOIS do banco.sql.
--
-- ONDE COLAR: Supabase > SQL Editor > New query > cole tudo > Run.
-- Se você já tiver vídeos reais no painel, este arquivo não insere nada.
-- Os 3 primeiros levam "+1.000 views" como destaque (o número que você
-- me passou). Troque no painel pelo número certo quando quiser.
-- =====================================================================
insert into public.videos (titulo, link, nicho, formato, marca, destaque, ordem, visivel, exemplo)
select * from (values
  ('Vídeo de skincare',                'https://youtube.com/shorts/ZZoSb8IljPw', 'skincare',         'vídeo 9:16', null,    '+1.000 views',  1, true, false),
  ('Vídeo de casa e decoração',        'https://youtube.com/shorts/TX4IBQr0ZE4', 'casa e decoração', 'vídeo 9:16', null,    '+1.000 views',  2, true, false),
  ('Vídeo de moda',                    'https://youtube.com/shorts/JOZyCMSgrLg', 'moda',             'vídeo 9:16', null,    '+1.000 views',  3, true, false),
  ('Vídeo de moda',                    'https://youtube.com/shorts/-_1NY4habg0', 'moda',             'vídeo 9:16', null,    null,            4, true, false),
  ('Vídeo de casa e decoração',        'https://youtube.com/shorts/5ooUE9kIQ88', 'casa e decoração', 'vídeo 9:16', null,    null,            5, true, false),
  ('Vídeo de aplicativo',              'https://youtube.com/shorts/N_6Ys6f2R34', 'app',              'vídeo 9:16', null,    null,            6, true, false),
  ('Vídeo de cabelos',                 'https://youtube.com/shorts/t49i1IJJZ68', 'cabelos',          'vídeo 9:16', null,    null,            7, true, false),
  ('Vídeo de acessórios',              'https://youtube.com/shorts/f-olPvZghdQ', 'acessórios',       'vídeo 9:16', null,    null,            8, true, false),
  ('Novo lançamento babado de Vichy',  'https://youtube.com/shorts/gZfgKa4RVZQ', 'skincare',         'vídeo 9:16', 'Vichy', null,            9, true, false),
  ('Seca em minutos',                  'https://youtube.com/shorts/O8kRgkeMjYU', 'cabelos',          'vídeo 9:16', null,    null,           10, true, false)
) as v (titulo, link, nicho, formato, marca, destaque, ordem, visivel, exemplo)
where not exists (select 1 from public.videos where exemplo = false);
