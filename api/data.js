import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // Salvato nelle impostazioni di Vercel/Netlify, mai nel codice!
});

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const PATH = "data.json";

export default async function handler(req, res) {
  // CORS headers se necessario
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // --- LETTURA DATI DA GITHUB ---
      try {
        const response = await octokit.repos.getContent({
          owner: OWNER,
          repo: REPO,
          path: PATH,
        });

        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return res.status(200).json({
          data: JSON.parse(content),
          sha: response.data.sha
        });
      } catch (error) {
        if (error.status === 404) {
          // File non ancora esistente, restituiamo array vuoto
          return res.status(200).json({ data: [], sha: null });
        }
        throw error;
      }
    } 
    
    else if (req.method === 'POST') {
      // --- SCRITTURA DATI SU GITHUB ---
      const { newData, sha } = req.body;

      // 1. Se non viene passato lo sha dal client, lo recuperiamo al volo
      let currentSha = sha;
      if (!currentSha) {
        try {
          const currentFile = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: PATH });
          currentSha = currentFile.data.sha;
        } catch (e) {
          // Se il file non esiste, sha resta undefined
        }
      }

      // 2. Salvataggio del file aggiornato
      const response = await octokit.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: PATH,
        message: "Aggiornamento dati da webapp multiutente",
        content: Buffer.from(JSON.stringify(newData, null, 2)).toString('base64'),
        sha: currentSha,
      });

      return res.status(200).json({ success: true, sha: response.data.content.sha });
    }

    return res.status(405).json({ error: "Metodo non consentito" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}