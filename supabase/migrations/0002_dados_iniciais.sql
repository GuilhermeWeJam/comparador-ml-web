-- Comparador ML Web — dados iniciais (rode depois de 0001_estrutura.sql).
-- Pode rodar de novo: atualiza sem duplicar.

insert into public.configuracoes (id, pesos) values (1, '{"triagem": {"lucro": 30, "frete": 20, "logistica": 15, "risco": 15, "epoca": 10, "comissao": 10}, "decisao": {"margem": 35, "demanda": 25, "concorrencia": 20, "risco": 20}, "faixas": {"alta": 70, "media": 40}, "veredito": {"anunciar": 70, "testar": 40, "descontoMax": 0.25}}'::jsonb)
  on conflict (id) do nothing;

-- Comissões do Mercado Livre por categoria (tabela enviada por você; edite em Configurações)
insert into public.comissoes_ml (categoria_ml, classico, premium, padrao) values
  ('Eletrodomésticos', 0.11, 0.16, false),
  ('Casa, Móveis e Decoração', 0.115, 0.165, false),
  ('Instrumentos Musicais', 0.115, 0.165, false),
  ('Acessórios para Veículos', 0.12, 0.17, false),
  ('Animais', 0.125, 0.175, false),
  ('Informática / Celulares e Telefones', 0.13, 0.18, false),
  ('Beleza e Cuidado Pessoal', 0.13, 0.17, false),
  ('Alimentos e Bebidas', 0.14, 0.19, false),
  ('Calçados, Roupas e Bolsas', 0.14, 0.19, false),
  ('Padrão (sem categoria na tabela)', 0.13, 0.18, true)
on conflict (categoria_ml) do update set classico = excluded.classico, premium = excluded.premium, padrao = excluded.padrao;

-- Categorias do fornecedor ligadas a uma categoria do ML (vazio = padrão) e época (alta agora: Natal e verão)
insert into public.categorias (nome, categoria_ml, epoca) values
  ('Acessórios de Banheiro', 'Casa, Móveis e Decoração', 'normal'),
  ('Acessórios para Elétricas', null, 'normal'),
  ('Automotivo', 'Acessórios para Veículos', 'normal'),
  ('Banheiro', 'Casa, Móveis e Decoração', 'normal'),
  ('Bebês', null, 'normal'),
  ('Beleza e Cuidado Pessoal', 'Beleza e Cuidado Pessoal', 'normal'),
  ('Bike e Patins', null, 'normal'),
  ('Bolsas e Malas de Viagem', 'Calçados, Roupas e Bolsas', 'normal'),
  ('Bonecas e Casinhas', null, 'normal'),
  ('Box e Tapetes', 'Casa, Móveis e Decoração', 'normal'),
  ('Brinquedos', null, 'normal'),
  ('Brinquedos Pet', 'Animais', 'normal'),
  ('Cadernos', null, 'normal'),
  ('Calçados e Pantufas', 'Calçados, Roupas e Bolsas', 'normal'),
  ('Capas e Protetores', 'Casa, Móveis e Decoração', 'normal'),
  ('Carrinhos e Pistas', null, 'normal'),
  ('Casinhas e Transporte', 'Animais', 'normal'),
  ('Climatização', 'Eletrodomésticos', 'normal'),
  ('Comedouros e Bebedouros', 'Animais', 'normal'),
  ('Copos, Jarras e Servir', 'Casa, Móveis e Decoração', 'normal'),
  ('Cortinas, Almofadas e Mantas', 'Casa, Móveis e Decoração', 'normal'),
  ('Cozinha', 'Casa, Móveis e Decoração', 'normal'),
  ('Decoração', 'Casa, Móveis e Decoração', 'normal'),
  ('Decoração e Têxteis', 'Casa, Móveis e Decoração', 'normal'),
  ('Eletroportáteis', 'Eletrodomésticos', 'normal'),
  ('Eletroportáteis de Cozinha', 'Eletrodomésticos', 'normal'),
  ('Eletrônicos e Acessórios', 'Informática / Celulares e Telefones', 'normal'),
  ('Escritório', null, 'normal'),
  ('Esporte e Lazer', null, 'normal'),
  ('Fantasias', null, 'normal'),
  ('Ferramentas Manuais', null, 'normal'),
  ('Ferramentas e Automotivo', null, 'normal'),
  ('Festas e Balões', null, 'normal'),
  ('Fitness', null, 'normal'),
  ('Garrafas e Térmicas', 'Casa, Móveis e Decoração', 'normal'),
  ('Guarda-roupa e Cabides', 'Casa, Móveis e Decoração', 'normal'),
  ('Higiene Pet', 'Animais', 'normal'),
  ('Iluminação', 'Casa, Móveis e Decoração', 'normal'),
  ('Iluminação Natalina', 'Casa, Móveis e Decoração', 'alta'),
  ('Inverno', null, 'normal'),
  ('Jardim', 'Casa, Móveis e Decoração', 'normal'),
  ('Jogos e Educativos', null, 'normal'),
  ('Lavanderia', 'Casa, Móveis e Decoração', 'normal'),
  ('Limpeza da Casa', 'Casa, Móveis e Decoração', 'normal'),
  ('Lixeiras', 'Casa, Móveis e Decoração', 'normal'),
  ('Material Escolar', null, 'normal'),
  ('Mochilas, Estojos e Lancheiras', null, 'normal'),
  ('Moda, Malas e Acessórios', 'Calçados, Roupas e Bolsas', 'normal'),
  ('Natal e Festas', 'Casa, Móveis e Decoração', 'alta'),
  ('Organizadores e Cestos', 'Casa, Móveis e Decoração', 'normal'),
  ('Organização', 'Casa, Móveis e Decoração', 'normal'),
  ('Panelas e Frigideiras', 'Casa, Móveis e Decoração', 'normal'),
  ('Papelaria e Escritório', null, 'normal'),
  ('Passeio e Elétricos', null, 'normal'),
  ('Pets', 'Animais', 'normal'),
  ('Potes, Marmitas e Mantimentos', 'Casa, Móveis e Decoração', 'normal'),
  ('Praia, Piscina e Camping', null, 'alta'),
  ('Prateleiras e Suportes', 'Casa, Móveis e Decoração', 'normal'),
  ('Utensílios e Talheres', 'Casa, Móveis e Decoração', 'normal'),
  ('Utilidades Domésticas', 'Casa, Móveis e Decoração', 'normal'),
  ('Árvores e Enfeites', 'Casa, Móveis e Decoração', 'alta')
on conflict (nome) do nothing;

-- Tabela oficial de custos de envio do ML (mercadolivre.com.br/ajuda/40538), reputação verde ou sem reputação
insert into public.tabela_frete (id, versao, fonte, preco_ini, peso_ini, valores) values (1, 'ml-40538-2026', 'mercadolivre.com.br/ajuda/40538',
  '{0,19,49,79,100,120,150,200}', '{0,0.301,0.501,1.001,1.501,2.001,3.001,4.001,5.001,6.001,7.001,8.001,9.001,10.001,11.001,13.001,15.001,17.001,20.001,25.001,30.001,40.001,50.001,60.001,70.001,80.001,90.001,100.001,125.001,150.001}',
  '[[5.65, 6.85, 8.15, 12.95, 14.95, 16.95, 19.05, 21.65], [5.95, 6.95, 8.25, 13.85, 16.15, 18.15, 20.45, 23.25], [6.05, 7.15, 8.45, 14.45, 16.85, 19.05, 21.35, 24.45], [6.15, 7.35, 8.65, 14.75, 17.15, 19.45, 21.75, 25.45], [6.25, 7.45, 8.75, 15.05, 17.65, 19.85, 22.25, 25.55], [6.35, 8.65, 9.15, 16.45, 19.15, 21.65, 24.35, 27.05], [6.45, 8.75, 9.75, 17.85, 20.75, 23.35, 26.35, 29.25], [6.55, 8.85, 10.25, 19.75, 22.85, 26.05, 29.25, 32.45], [6.65, 8.95, 10.35, 25.95, 29.15, 33.35, 36.45, 40.85], [6.75, 9.05, 10.45, 27.55, 31.65, 36.75, 40.85, 45.25], [6.85, 9.25, 10.55, 29.45, 34.35, 39.25, 44.15, 49.35], [6.95, 9.35, 10.65, 30.25, 35.25, 40.35, 45.35, 50.75], [7.05, 9.45, 10.85, 38.25, 45.05, 51.95, 58.75, 65.85], [7.05, 9.65, 11.05, 41.65, 48.55, 55.45, 62.35, 69.35], [7.15, 10.05, 11.45, 42.55, 49.75, 56.85, 63.85, 70.95], [7.25, 10.25, 11.65, 45.55, 52.95, 60.55, 68.15, 75.65], [7.35, 10.45, 11.85, 48.95, 56.55, 64.05, 71.35, 79.35], [7.45, 10.65, 12.05, 55.15, 64.35, 73.55, 82.75, 91.95], [7.65, 11.05, 12.25, 64.55, 75.75, 85.45, 96.25, 106.85], [7.75, 11.25, 12.45, 66.45, 76.05, 86.25, 97.15, 107.85], [7.85, 11.45, 12.65, 68.35, 79.65, 89.75, 100.05, 107.95], [7.95, 11.65, 12.85, 70.95, 81.85, 92.85, 103.45, 111.65], [8.05, 11.85, 13.05, 75.55, 87.25, 99.05, 110.25, 119.05], [8.15, 12.05, 13.25, 80.95, 93.75, 105.95, 118.05, 127.45], [8.25, 12.25, 13.45, 84.65, 97.95, 110.75, 123.35, 133.15], [8.35, 12.45, 13.65, 94.05, 108.35, 122.95, 136.95, 147.85], [8.45, 12.65, 13.85, 107.45, 124.85, 140.45, 156.45, 168.85], [8.55, 12.85, 14.05, 120.15, 138.95, 156.95, 174.85, 188.85], [8.65, 12.85, 14.25, 127.45, 147.05, 166.55, 185.55, 200.35], [8.75, 12.85, 14.45, 167.05, 193.35, 218.45, 243.45, 262.85]]'::jsonb)
on conflict (id) do update set versao = excluded.versao, fonte = excluded.fonte, preco_ini = excluded.preco_ini, peso_ini = excluded.peso_ini, valores = excluded.valores, atualizado_em = now();
