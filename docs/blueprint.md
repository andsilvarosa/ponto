# **App Name**: Ponto Ágil

## Core Features:

- Entrada de Número de Matrícula: Oferecer uma interface de usuário para inserir e armazenar com segurança o número de matrícula do funcionário.
- Recuperação de Dados de Ponto: Acessar programaticamente a página .NET externa (https://webapp.confianca.com.br/consultaponto/ponto.aspx#gridhora) para buscar dados mensais de ponto com base no número de matrícula fornecido usando técnicas de web scraping.
- Ferramenta de Análise de Dados Aprimorada por IA: Uma ferramenta de IA que pode adaptar dinamicamente a lógica de análise a variações na estrutura da página .NET externa, garantindo a extração de dados robusta e contínua, mesmo que o layout da fonte mude.
- Painel de Horas Mensais: Exibir os horários de ponto recuperados, totais mensais calculados e saldo atual em uma visualização clara e resumida.
- Entrada de Saldo do Mês Anterior: Para números de matrícula novos ou não reconhecidos, permitir que o usuário insira manualmente o saldo de horas do mês anterior para calcular um total cumulativo preciso.
- Armazenamento Persistente de Dados: Salvar números de matrícula, seus dados mensais de ponto associados e o saldo do mês anterior em um banco de dados Firestore para rastreamento histórico e recuperação rápida.
- Utilitário de Limpeza de Dados: Um recurso para limpar os dados exibidos atualmente ou remover dados de matrícula armazenados, fornecendo uma função 'Limpar' semelhante ao site original.

## Style Guidelines:

- Cor primária: Um verde-amarelo vibrante e fresco (#DEE337), evocando energia e uma sensação limpa e eficiente. Esta cor é usada para elementos interativos chave.
- Cor de fundo: Um verde-amarelo muito claro e dessaturado (#F7F9ED), proporcionando um pano de fundo limpo e sutil que se alinha com a cor primária.
- Cor de destaque: Um amarelo brilhante e alegre (#FCD231) usado para chamar a atenção para chamadas à ação importantes ou destacar informações críticas, criando um bom contraste visual com a cor primária.
- Fonte para corpo e títulos: 'Inter' (sans-serif), para uma experiência moderna, objetiva e altamente legível em todo o conteúdo.
- Usar ícones funcionais e intuitivos em estilo 'line-art', como uma lupa para 'Consultar' e uma lixeira para 'Limpar', para melhorar a usabilidade.
- Manter um layout limpo e focado com campos de entrada claros, botões de chamada à ação proeminentes e áreas de exibição bem organizadas para os dados de ponto.
- Incorporar animações sutis para estados de carregamento e feedback de botões, proporcionando uma experiência de usuário suave e responsiva.