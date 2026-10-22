const permissoes = {
    administrador: "*",
    gerente: {
        usuarios:["GET"],
        lotes: ["GET"],
        alertas: ["GET"],
        producao: ["GET"],
        esteiras: ["GET"],
        leituras_sensor: ["GET"],
        fornecedores: ["GET"],
    },
    operador: {
        lotes: ["GET"],
        alertas: ["GET"],
        producao: ["GET"],
        esteiras: ["GET"],
        leituras_sensor: ["GET"],
        fornecedores: ["GET"],
    }
}

module.exports = (req, res, next) => {
    if(req.method === "OPTIONS"){
        next();
        return;
    }

    const recurso = req.path.split('/')[1];
    const perfil = req.claims.perfil;

    if(perfil === "administrador"){
        next();
        return;
    }

    const regras = permissoes[perfil]?.[recurso];

    if(regras?.includes(req.method)){
        next();
        return;
    }else{
        res.status(403).json({erro: "sem permissão"})
    }
};