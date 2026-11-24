# Política de documentação e portfólio — AulaViva Studio

> **Fonte oficial:** este repositório GitHub. Toda evolução funcional, arquitetural e comercial do AulaViva Studio deve ser documentada aqui, junto ao código. Esta política foi estabelecida em 23 de novembro de 2026.

## Objetivo

Manter o GitHub como portfólio público/técnico do projeto: permitir que professores, colaboradores, recrutadores e avaliadores compreendam o que foi construído, por que as decisões foram tomadas, como executar o sistema e qual é o estado real de cada recurso.

## Obrigatório em cada mudança relevante

1. **Código e documentação na mesma branch:** atualizar a documentação apropriada junto da implementação, antes do merge. Não depender apenas de conversas externas.
2. **Commits claros:** mensagens descritivas por funcionalidade, correção, teste ou documentação.
3. **Pull Request rastreável:** registrar objetivo, mudanças, motivação, riscos, compatibilidade, testes realizados, testes pendentes e tarefas futuras.
4. **README atualizado:** refletir a arquitetura e o estado de produção; distinguir recurso em desenvolvimento de recurso disponível. Referenciar páginas técnicas em `docs/`.
5. **Decisões arquiteturais:** registrar escolhas importantes, alternativas e consequências em `docs/adr/` (Architecture Decision Records).
6. **Migrações de banco/API:** manter SQL versionado, contrato das rotas, variáveis de ambiente de exemplo e instruções de implantação.
7. **Testes e validação:** documentar comandos executados e resultados reais; não alegar teste ou deploy sem execução confirmada.
8. **Evolução de produto:** atualizar o histórico de mudanças e o roadmap quando regras de planos, créditos, autenticação, privacidade ou funcionalidades mudarem.
9. **Segurança:** nunca versionar segredos, tokens, senhas, chaves privadas, dados reais de usuários nem capturas com informações sensíveis.

## Estrutura documental

- `README.md`: apresentação oficial, demonstrações e guia rápido.
- `docs/PROJECT-DOCUMENTATION.md`: política de documentação e portfólio.
- `docs/adr/`: decisões arquiteturais numeradas.
- `docs/SUPABASE-VERCEL-SETUP.md`: implantação da nova infraestrutura de autenticação e franquia.
- `supabase/migrations/`: mudanças auditáveis no banco de dados.
- Pull Requests: evolução concreta, testes e revisão técnica.
- Histórico de commits: rastreabilidade de autoria e implementação.

## Situação da migração Supabase / Vercel

**Estado: em desenvolvimento — não liberado em produção.**

Branch: `feature/supabase-auth-usage-limits`  
PR: [#1 — Supabase Auth e controle de uso semanal](https://github.com/matheus1906-hash/Aula-Viva-Studio/pull/1)

Decisões de produto já estabelecidas:

- IA incluída, sem exigir chave própria do professor.
- 12 meses gratuitos contados da criação da conta.
- Após os 12 meses, manter funcionalidades essenciais e permitir 5 utilizações semanais de IA no nível gratuito.
- Preservar os materiais e dados existentes na migração.
- Limites contabilizados no servidor, não no navegador.

Pendências explícitas: integrar autenticação ao frontend, preservar/migrar o cofre com consentimento, rotear as gerações para Vercel Functions e configurar/verificar os serviços reais. Limites e preço dos planos pagos, franquia do primeiro ano e funcionalidades premium ainda não estão definidos.

## Critério de conclusão

Nenhuma tarefa relevante é considerada concluída apenas porque seu código foi enviado: ela precisa de documentação compatível, testes necessários e registro transparente do que está ou não funcionando. A branch principal só deve receber funcionalidades validadas e documentação revisada.

## Publicação GitHub em todas as mudanças

Toda alteração produzida no projeto deve ser registrada no GitHub na mesma entrega, em branch apropriada, com commit e documentação. Manter a `main` protegida de implementações não validadas. Mostrar no chat a diferença entre protótipo visual, código commitado e recurso realmente ativo em produção; nunca tratar uma prévia de interface como implantação concluída.
