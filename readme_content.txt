<p align="center">
  <img src="https://img.shields.io/badge/status-100%25_confian%C3%A7a_arquitetural-3fb950?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/tests-324_passed-3fb950?style=for-the-badge&logo=pytest&logoColor=white" alt="Tests">
  <img src="https://img.shields.io/badge/gaps-53%2F53_Feito-3fb950?style=for-the-badge" alt="Gaps">
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.141-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/SQLite%2FPostgreSQL-4479A1?style=for-the-badge&logo=sqlite&logoColor=white" alt="Banco de dados">
  <img src="https://img.shields.io/badge/JWT%20Auth-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white" alt="JWT Auth">
</p>

# 🏗️ Archia — Editor Visual de System Design com IA

**Desenhe, analise e simule arquiteturas de software reais** (zonas VPC/AZ, fluxos tipados multi-cloud) **e stacks** em um canvas visual — com avaliação no nível de um Software Architect.

O **Archia** é um SaaS que permite modelar arquiteturas de sistemas (componentes + conexões) arrastando e soltando blocos em um canvas, e recebe em troca uma **análise completa**: over/under-engineering, gargalos, riscos de segurança, custo mensal estimado e nota justificada. Tudo isso combinando **IA** (via OmniRoute/OpenAI/Anthropic) com **heurísticas locais determinísticas** que funcionam mesmo sem conexão com provedores de IA.

> 💡 **Caso de uso principal:** arquitetos e devs seniores usam o Archia para validar uma proposta de stack antes de escrever código — o editor entrega recomendações, compara alternativas lado a lado e simula o comportamento da arquitetura sob carga.

> ✅ **Status:** 100% de confiança arquitetural atingido (53/53 gaps P0-P3 fechados, 324 testes passando: 298 backend + 26 frontend). Ver [`docs/GAPS-POR-PRIORIDADE.md`](docs/GAPS-POR-PRIORIDADE.md) e [`docs/PERFORMANCE-AUDIT.md`](docs/PERFORMANCE-AUDIT.md).

---

## 📑 Sumário

1. [Sobre o projeto](#-sobre-o-projeto)
2. [Stack tecnológica](#-stack-tecnológica)
3. [Funcionalidades](#-funcionalidades)
4. [Performance e Otimizações](#-performance-e-otimizações)
5. [Pré-requisitos](#-pré-requisitos)
6. [Instalação](#-instalação)
7. [Variáveis de ambiente](#-variáveis-de-ambiente)
8. [Executando o projeto](#-executando-o-projeto)
9. [Credenciais padrão](#-cred