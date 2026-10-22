// features/login/mock-users.js
// Usuários de teste (RF01). Removido na integração com a API real.
//
// Os mesmos logins, nomes e perfis do mocks/db.json (tabela usuarios).
// Senha de TODOS os usuários de teste: "ecocycle123" (só para o mock, nunca reutilizar).
//
// Tokens: JWT HS256 de exemplo com o payload
//   { sub, nome, perfil, iat, exp }
// O front-end NÃO valida a assinatura (quem valida é a API): ele só lê o payload
// para conferir o `exp` e o `perfil`. Os nomes dos campos do payload são provisórios,
// até a Equipe 2 definir o formato do login (alinhamento pendente nº 5).
//
// Cada usuário tem um `exp` diferente. Só o token de "operador1" está VENCIDO
// (exp 01/09/2026 16:39 UTC): use esse login para testar a queda de sessão.

export const mockUsers = [
  // admin: token válido (exp 01/10/2027 15:10 UTC)
  {
    id_usuario: 1,
    login: "admin",
    senha: "ecocycle123",
    nome: "Marina Costa",
    perfil: "administrador",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwibm9tZSI6Ik1hcmluYSBDb3N0YSIsInBlcmZpbCI6ImFkbWluaXN0cmFkb3IiLCJpYXQiOjE3OTIzMTA2NDAsImV4cCI6MTgyMjQwMzQwMH0.9SDoEDu5Yux_Shq9CJFav4wB8D3mONtIRDipRMZmBCs",
  },
  // gerente1: token válido (exp 03/10/2027 03:23 UTC)
  {
    id_usuario: 2,
    login: "gerente1",
    senha: "ecocycle123",
    nome: "Roberto Alves",
    perfil: "gerente",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwibm9tZSI6IlJvYmVydG8gQWx2ZXMiLCJwZXJmaWwiOiJnZXJlbnRlIiwiaWF0IjoxNzkyMTc3MjAwLCJleHAiOjE4MjI1MzM3ODB9.MGzWuctWrsZuhGSBUzLV17HKT9_zWz7jnKFs46B4DN0",
  },
  // gerente2: token válido (exp 26/02/2027 13:51 UTC)
  {
    id_usuario: 3,
    login: "gerente2",
    senha: "ecocycle123",
    nome: "Patrícia Lima",
    perfil: "gerente",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwibm9tZSI6IlBhdHLDrWNpYSBMaW1hIiwicGVyZmlsIjoiZ2VyZW50ZSIsImlhdCI6MTc5MjA2ODc4MCwiZXhwIjoxODAzNjQ5ODYwfQ.YHFOcf1suFg_-bkGxqi00OW4H5dr16kZi_i1RsIvoR0",
  },
  // operador1: token VENCIDO (exp 01/09/2026 16:39 UTC)
  {
    id_usuario: 4,
    login: "operador1",
    senha: "ecocycle123",
    nome: "João Pereira",
    perfil: "operador",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0Iiwibm9tZSI6Ikpvw6NvIFBlcmVpcmEiLCJwZXJmaWwiOiJvcGVyYWRvciIsImlhdCI6MTc4ODI1MTk0MCwiZXhwIjoxNzg4MjgwNzQwfQ.KbpXHrw-0E6bhqogw9ctPMw2XT9mbXze5vqRw_QQAUQ",
  },
  // operador2: token válido (exp 13/09/2027 18:54 UTC)
  {
    id_usuario: 5,
    login: "operador2",
    senha: "ecocycle123",
    nome: "Fernanda Rocha",
    perfil: "operador",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1Iiwibm9tZSI6IkZlcm5hbmRhIFJvY2hhIiwicGVyZmlsIjoib3BlcmFkb3IiLCJpYXQiOjE3OTIxMzYyODAsImV4cCI6MTgyMDg2MTY0MH0.h1bPFnSOS7STFt57cL5SdxoyjmpElI_iN-Tw1YaIV4U",
  },
  // operador3: token válido (exp 05/09/2027 05:03 UTC)
  {
    id_usuario: 6,
    login: "operador3",
    senha: "ecocycle123",
    nome: "Lucas Martins",
    perfil: "operador",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2Iiwibm9tZSI6Ikx1Y2FzIE1hcnRpbnMiLCJwZXJmaWwiOiJvcGVyYWRvciIsImlhdCI6MTc5MTk1NDQyMCwiZXhwIjoxODIwMTIwNTgwfQ.WZFZuDhNcxI-I7wXc6fcRFbxF4rRXn1M8IofDirhclA",
  },
];

// Não é um JWT. O decodificador não pode quebrar a página: deve tratar como sessão inválida.
export const testTokens = {
  malformado: "isto.nao-e-um-jwt",
};