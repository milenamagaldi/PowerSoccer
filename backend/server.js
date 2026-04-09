const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const porta = 3000;

app.use(cors());
app.use(express.json());

const conexao = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'alunolab',
    database: 'power_soccer',
    port: "3303"
});

conexao.connect((erro) => {
    if (erro) {
        console.error('❌ Erro ao conectar no MySQL:', erro.message);
        return;
    }
    console.log('✅ Conexão com o banco power_soccer estabelecida com sucesso!');
});

app.get('/', (req, res) => {
    res.json({ mensagem: 'A API do Scout Power Soccer está rodando!' });
});

app.post('/api/eventos', (req, res) => {
    const { atleta_id, minuto_video, tipo_acao, coord_x, coord_y, jogador_entrou_id } = req.body;
    
    const sql = `INSERT INTO eventos_scout (partida_id, atleta_id, usuario_id, periodo, minuto_video, tipo_acao, coord_x, coord_y, jogador_entrou_id) 
                 VALUES (1, ?, 1, '1º Tempo', ?, ?, ?, ?, ?)`;
    
    conexao.query(sql, [atleta_id, minuto_video, tipo_acao, coord_x || null, coord_y || null, jogador_entrou_id || null], (erro, resultados) => {
        if (erro) {
            console.error('Erro ao salvar no banco:', erro);
            return res.status(500).json({ erro: 'Erro interno ao salvar' });
        }
        res.status(201).json({ mensagem: 'Ação salva!', id_registro: resultados.insertId });
    });
});

app.get('/api/estatisticas', (req, res) => {
    const sql = `
        SELECT 
            a.nome AS atleta,
            SUM(CASE WHEN e.tipo_acao = 'Passe Certo' THEN 1 ELSE 0 END) AS passes_certos,
            SUM(CASE WHEN e.tipo_acao = 'Passe Errado' THEN 1 ELSE 0 END) AS passes_errados,
            SUM(CASE WHEN e.tipo_acao = 'Interceptação' THEN 1 ELSE 0 END) AS interceptacoes,
            SUM(CASE WHEN e.tipo_acao = 'Finalização' THEN 1 ELSE 0 END) AS finalizacoes,
            SUM(CASE WHEN e.tipo_acao = 'Gol' THEN 1 ELSE 0 END) AS gols
        FROM atletas a
        LEFT JOIN eventos_scout e ON a.id = e.atleta_id
        GROUP BY a.id, a.nome
        ORDER BY gols DESC, passes_certos DESC;
    `;

    conexao.query(sql, (erro, resultados) => {
        if (erro) {
            console.error('Erro ao buscar estatísticas:', erro);
            return res.status(500).json({ erro: 'Erro interno' });
        }
        res.json(resultados);
    });
});

app.get('/api/eventos/partida/:id', (req, res) => {
    const idPartida = req.params.id;
    const sql = `
        SELECT e.*, a.nome AS nome_atleta 
        FROM eventos_scout e
        JOIN atletas a ON e.atleta_id = a.id
        WHERE e.partida_id = ?
    `;
    
    conexao.query(sql, [idPartida], (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Erro ao buscar lances' });
        res.json(resultados);
    });
});

app.delete('/api/eventos/:id', (req, res) => {
    const idLance = req.params.id;
    const sql = 'DELETE FROM eventos_scout WHERE id = ?';

    conexao.query(sql, [idLance], (erro, resultados) => {
        if (erro) {
            console.error('Erro ao deletar:', erro);
            return res.status(500).json({ erro: 'Erro ao deletar o lance' });
        }
        res.json({ mensagem: 'Lance deletado com sucesso!' });
    });
});

app.put('/api/eventos/:id', (req, res) => {
    const idLance = req.params.id;
    const { tipo_acao, minuto_video } = req.body;
    
    const sql = 'UPDATE eventos_scout SET tipo_acao = ?, minuto_video = ? WHERE id = ?';

    conexao.query(sql, [tipo_acao, minuto_video, idLance], (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Erro ao atualizar' });
        res.json({ mensagem: 'Lance atualizado com sucesso!' });
    });
});

// Rota para resumo da Home (cards)
app.get('/api/resumo', (req, res) => {
    const sqlAtletas = 'SELECT COUNT(*) as total FROM atletas';
    const sqlPartidas = 'SELECT COUNT(*) as total FROM partidas';
    const sqlScouts = 'SELECT COUNT(*) as total FROM eventos_scout';
    // Calcula média de gols baseado nos eventos do tipo 'Gol'
    const sqlMediaGols = `SELECT ROUND(COUNT(*) / (SELECT COUNT(*) FROM partidas), 1) as media 
                          FROM eventos_scout 
                          WHERE tipo_acao = 'Gol'`;

    Promise.all([
        new Promise((resolve, reject) => conexao.query(sqlAtletas, (err, result) => err ? reject(err) : resolve(result[0].total))),
        new Promise((resolve, reject) => conexao.query(sqlPartidas, (err, result) => err ? reject(err) : resolve(result[0].total))),
        new Promise((resolve, reject) => conexao.query(sqlScouts, (err, result) => err ? reject(err) : resolve(result[0].total))),
        new Promise((resolve, reject) => conexao.query(sqlMediaGols, (err, result) => err ? reject(err) : resolve(result[0]?.media || 0)))
    ]).then(([atletas, partidas, scouts, mediaGols]) => {
        res.json({ atletas, partidas, scouts, mediaGols });
    }).catch(erro => {
        console.error('Erro no resumo:', erro);
        res.status(500).json({ error: 'Erro ao buscar resumo' });
    });
});

app.listen(porta, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${porta}`);
});