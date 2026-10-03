import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Dozvoli ugradnju (iframe) na svim vanjskim domenama (Blogger/Blogspot)
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors *;");
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const DATA_FILE = path.resolve(process.cwd(), 'election_state.json');

// Types for election state
interface Candidate {
  id: string;
  name: string;
  party: string;
  partyShort: string;
  votes: number;
  percent: number;
  color: string;
  textClass: string;
}

interface PartyResult {
  name: string;
  shortName: string;
  votes: number;
  percent: number;
  estimatedSeats: number;
  color: string;
}

interface Canton {
  id: number;
  name: string;
  processedPercent: number;
  turnoutPercent: number;
  totalVoters: number;
  parties: {
    name: string;
    shortName: string;
    votes: number;
    percent: number;
    color: string;
  }[];
}

interface ElectionState {
  totalVoters: number;
  overallTurnoutPercent: number;
  processedPollingStationsPercent: number;
  lastUpdated: string;
  adminPassword: string;
  statusMessage: string;
  simulationActive: boolean;
  simulationSpeed: number; // 1 = slow, 5 = fast
  predsjednistvo: {
    bosnjacki: Candidate[];
    hrvatski: Candidate[];
    srpski: Candidate[];
  };
  parlamentBiH: PartyResult[];
  parlamentFBiH: PartyResult[];
  kantoni: Canton[];
}

// Seed / Initial realistic data for Opći Izbori 2026
const initialElectionState: ElectionState = {
  totalVoters: 3418290,
  overallTurnoutPercent: 51.4,
  processedPollingStationsPercent: 12.3,
  lastUpdated: new Date().toISOString(),
  adminPassword: 'izbori2026',
  statusMessage: 'Preliminarni, nezvanični rezultati Centralne izborne komisije (CIK) BiH.',
  simulationActive: false,
  simulationSpeed: 2,
  predsjednistvo: {
    bosnjacki: [
      { id: 'b1', name: 'Denis Bećirović', party: 'Socijaldemokratska Partija BiH (SDP)', partyShort: 'SDP', votes: 41250, percent: 43.1, color: '#DC2626', textClass: 'text-red-600' },
      { id: 'b2', name: 'Bakir Izetbegović', party: 'Stranka Demokratske Akcije (SDA)', partyShort: 'SDA', votes: 38700, percent: 40.5, color: '#059669', textClass: 'text-emerald-600' },
      { id: 'b3', name: 'Semir Efendić', party: 'Stranka za Bosnu i Hercegovinu (SBiH)', partyShort: 'SBiH', votes: 15720, percent: 16.4, color: '#2563EB', textClass: 'text-blue-600' }
    ],
    hrvatski: [
      { id: 'h1', name: 'Željko Komšić', party: 'Demokratska Fronta (DF)', partyShort: 'DF', votes: 49100, percent: 52.2, color: '#D97706', textClass: 'text-amber-600' },
      { id: 'h2', name: 'Borjana Krišto', party: 'Hrvatska Demokratska Zajednica BiH (HDZ)', partyShort: 'HDZ BiH', votes: 39500, percent: 42.0, color: '#1E3A8A', textClass: 'text-blue-900' },
      { id: 'h3', name: 'Slaven Raguž', party: 'Hrvatska Republikanska Stranka (HRS)', partyShort: 'HRS', votes: 5400, percent: 5.8, color: '#EA580C', textClass: 'text-orange-600' }
    ],
    srpski: [
      { id: 's1', name: 'Željka Cvijanović', party: 'Savez Nezavisnih Socijaldemokrata (SNSD)', partyShort: 'SNSD', votes: 45800, percent: 46.8, color: '#991B1B', textClass: 'text-red-800' },
      { id: 's2', name: 'Jelena Trivić', party: 'Narodni Front (NF)', partyShort: 'NF', votes: 34200, percent: 35.0, color: '#0891B2', textClass: 'text-cyan-600' },
      { id: 's3', name: 'Milan Miličević', party: 'Srpska Demokratska Stranka (SDS)', partyShort: 'SDS', votes: 17800, percent: 18.2, color: '#1D4ED8', textClass: 'text-blue-700' }
    ]
  },
  parlamentBiH: [
    { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 52400, percent: 22.1, estimatedSeats: 9, color: '#059669' },
    { name: 'Savez Nezavisnih Socijaldemokrata', shortName: 'SNSD', votes: 46800, percent: 19.7, estimatedSeats: 8, color: '#991B1B' },
    { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP BiH', votes: 38200, percent: 16.1, estimatedSeats: 7, color: '#DC2626' },
    { name: 'Hrvatska Demokratska Zajednica BiH', shortName: 'HDZ BiH', votes: 31500, percent: 13.3, estimatedSeats: 5, color: '#1E3A8A' },
    { name: 'Demokratska Fronta', shortName: 'DF', votes: 21800, percent: 9.2, estimatedSeats: 4, color: '#D97706' },
    { name: 'Srpska Demokratska Stranka', shortName: 'SDS', votes: 18900, percent: 8.0, estimatedSeats: 3, color: '#1D4ED8' },
    { name: 'Narod i Pravda', shortName: 'NiP', votes: 15400, percent: 6.5, estimatedSeats: 3, color: '#0F172A' },
    { name: 'Ostale stranke', shortName: 'Ostali', votes: 12100, percent: 5.1, estimatedSeats: 3, color: '#64748B' }
  ],
  parlamentFBiH: [
    { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 61400, percent: 24.2, estimatedSeats: 25, color: '#059669' },
    { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP BiH', votes: 45200, percent: 17.8, estimatedSeats: 18, color: '#DC2626' },
    { name: 'Hrvatska Demokratska Zajednica BiH', shortName: 'HDZ BiH', votes: 38900, percent: 15.3, estimatedSeats: 16, color: '#1E3A8A' },
    { name: 'Demokratska Fronta', shortName: 'DF', votes: 29500, percent: 11.6, estimatedSeats: 12, color: '#D97706' },
    { name: 'Narod i Pravda', shortName: 'NiP', votes: 25100, percent: 9.9, estimatedSeats: 10, color: '#0F172A' },
    { name: 'Naša Stranka', shortName: 'NS', votes: 18200, percent: 7.2, estimatedSeats: 7, color: '#EC4899' },
    { name: 'Stranka za BiH', shortName: 'SBiH', votes: 15400, percent: 6.1, estimatedSeats: 6, color: '#2563EB' },
    { name: 'Ostale stranke', shortName: 'Ostali', votes: 20100, percent: 7.9, estimatedSeats: 4, color: '#64748B' }
  ],
  kantoni: [
    {
      id: 9,
      name: 'Kanton Sarajevo',
      processedPercent: 15.5,
      turnoutPercent: 54.2,
      totalVoters: 384000,
      parties: [
        { name: 'Narod i Pravda', shortName: 'NiP', votes: 12400, percent: 26.5, color: '#0F172A' },
        { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 10800, percent: 23.1, color: '#059669' },
        { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP', votes: 8500, percent: 18.2, color: '#DC2626' },
        { name: 'Naša Stranka', shortName: 'NS', votes: 7200, percent: 15.4, color: '#EC4899' },
        { name: 'Stranka za BiH', shortName: 'SBiH', votes: 4100, percent: 8.8, color: '#2563EB' },
        { name: 'Ostali', shortName: 'Ostali', votes: 3800, percent: 8.0, color: '#64748B' }
      ]
    },
    {
      id: 3,
      name: 'Tuzlanski kanton',
      processedPercent: 11.2,
      turnoutPercent: 49.8,
      totalVoters: 415000,
      parties: [
        { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 14500, percent: 31.2, color: '#059669' },
        { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP', votes: 11200, percent: 24.1, color: '#DC2626' },
        { name: 'Demokratska Fronta', shortName: 'DF', votes: 6800, percent: 14.6, color: '#D97706' },
        { name: 'Pokret Demokratske Akcije', shortName: 'PDA', votes: 4500, percent: 9.7, color: '#1D4ED8' },
        { name: 'Stranka za BiH', shortName: 'SBiH', votes: 3200, percent: 6.9, color: '#2563EB' },
        { name: 'Ostali', shortName: 'Ostali', votes: 6270, percent: 13.5, color: '#64748B' }
      ]
    },
    {
      id: 4,
      name: 'Zeničko-dobojski kanton',
      processedPercent: 14.1,
      turnoutPercent: 51.5,
      totalVoters: 330000,
      parties: [
        { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 13100, percent: 28.5, color: '#059669' },
        { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP', votes: 9200, percent: 20.0, color: '#DC2626' },
        { name: 'Bosanskohercegovačka Inicijativa - KF', shortName: 'BHI-KF', votes: 7100, percent: 15.4, color: '#10B981' },
        { name: 'Demokratska Fronta', shortName: 'DF', votes: 5800, percent: 12.6, color: '#D97706' },
        { name: 'Narod i Pravda', shortName: 'NiP', votes: 4100, percent: 8.9, color: '#0F172A' },
        { name: 'Ostali', shortName: 'Ostali', votes: 6660, percent: 14.6, color: '#64748B' }
      ]
    },
    {
      id: 7,
      name: 'Hercegovačko-neretvanski kanton',
      processedPercent: 12.8,
      turnoutPercent: 52.1,
      totalVoters: 194000,
      parties: [
        { name: 'Hrvatska Demokratska Zajednica BiH', shortName: 'HDZ BiH', votes: 18400, percent: 45.4, color: '#1E3A8A' },
        { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 8900, percent: 22.0, color: '#059669' },
        { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP', votes: 4800, percent: 11.9, color: '#DC2626' },
        { name: 'HDZ 1990', shortName: 'HDZ 1990', votes: 3900, percent: 9.6, color: '#3B82F6' },
        { name: 'Demokratska Fronta', shortName: 'DF', votes: 2200, percent: 5.4, color: '#D97706' },
        { name: 'Ostali', shortName: 'Ostali', votes: 2310, percent: 5.7, color: '#64748B' }
      ]
    },
    {
      id: 6,
      name: 'Srednjobosanski kanton',
      processedPercent: 10.5,
      turnoutPercent: 50.2,
      totalVoters: 223000,
      parties: [
        { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 11800, percent: 31.5, color: '#059669' },
        { name: 'Hrvatska Demokratska Zajednica BiH', shortName: 'HDZ BiH', votes: 10400, percent: 27.7, color: '#1E3A8A' },
        { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP', votes: 5500, percent: 14.7, color: '#DC2626' },
        { name: 'Demokratska Fronta', shortName: 'DF', votes: 3800, percent: 10.1, color: '#D97706' },
        { name: 'Narod i Pravda', shortName: 'NiP', votes: 2900, percent: 7.7, color: '#0F172A' },
        { name: 'Ostali', shortName: 'Ostali', votes: 3100, percent: 8.3, color: '#64748B' }
      ]
    },
    {
      id: 1,
      name: 'Unsko-sanski kanton',
      processedPercent: 9.4,
      turnoutPercent: 43.1,
      totalVoters: 256000,
      parties: [
        { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 9400, percent: 28.5, color: '#059669' },
        { name: 'Narodni Evropski Savez', shortName: 'NES', votes: 8200, percent: 24.8, color: '#2563EB' },
        { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP', votes: 4500, percent: 13.6, color: '#DC2626' },
        { name: 'Demokratska Fronta', shortName: 'DF', votes: 3900, percent: 11.8, color: '#D97706' },
        { name: 'Pokret za Modernu i Aktivnu Krajinu', shortName: 'POMAK', votes: 3100, percent: 9.4, color: '#10B981' },
        { name: 'Ostali', shortName: 'Ostali', votes: 3900, percent: 11.9, color: '#64748B' }
      ]
    },
    {
      id: 8,
      name: 'Zapadnohercegovački kanton',
      processedPercent: 13.2,
      turnoutPercent: 48.5,
      totalVoters: 73000,
      parties: [
        { name: 'Hrvatska Demokratska Zajednica BiH', shortName: 'HDZ BiH', votes: 12200, percent: 69.3, color: '#1E3A8A' },
        { name: 'HDZ 1990', shortName: 'HDZ 1990', votes: 2400, percent: 13.6, color: '#3B82F6' },
        { name: 'Hrvatska Republikanska Stranka', shortName: 'HRS', votes: 1800, percent: 10.2, color: '#EA580C' },
        { name: 'Ostali', shortName: 'Ostali', votes: 1210, percent: 6.9, color: '#64748B' }
      ]
    },
    {
      id: 10,
      name: 'Kanton 10 (Livanjski kanton)',
      processedPercent: 11.0,
      turnoutPercent: 45.2,
      totalVoters: 61000,
      parties: [
        { name: 'Hrvatski Nacionalni Pomak', shortName: 'HNP', votes: 3200, percent: 31.4, color: '#F59E0B' },
        { name: 'Hrvatska Demokratska Zajednica BiH', shortName: 'HDZ BiH', votes: 2400, percent: 23.5, color: '#1E3A8A' },
        { name: 'HDZ 1990', shortName: 'HDZ 1990', votes: 1900, percent: 18.6, color: '#3B82F6' },
        { name: 'Savez Nezavisnih Socijaldemokrata', shortName: 'SNSD', votes: 1100, percent: 10.8, color: '#991B1B' },
        { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP', votes: 850, percent: 8.3, color: '#DC2626' },
        { name: 'Ostali', shortName: 'Ostali', votes: 750, percent: 7.4, color: '#64748B' }
      ]
    },
    {
      id: 2,
      name: 'Posavski kanton',
      processedPercent: 14.5,
      turnoutPercent: 46.8,
      totalVoters: 38000,
      parties: [
        { name: 'Hrvatska Demokratska Zajednica BiH', shortName: 'HDZ BiH', votes: 3900, percent: 52.7, color: '#1E3A8A' },
        { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 1100, percent: 14.9, color: '#059669' },
        { name: 'HDZ 1990', shortName: 'HDZ 1990', votes: 950, percent: 12.8, color: '#3B82F6' },
        { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP', votes: 750, percent: 10.1, color: '#DC2626' },
        { name: 'Ostali', shortName: 'Ostali', votes: 700, percent: 9.5, color: '#64748B' }
      ]
    },
    {
      id: 5,
      name: 'Bosansko-podrinjski kanton',
      processedPercent: 16.0,
      turnoutPercent: 55.4,
      totalVoters: 22000,
      parties: [
        { name: 'Stranka Demokratske Akcije', shortName: 'SDA', votes: 1150, percent: 22.1, color: '#059669' },
        { name: 'Socijaldemokratska Partija BiH', shortName: 'SDP', votes: 1050, percent: 20.2, color: '#DC2626' },
        { name: 'Narod i Pravda', shortName: 'NiP', votes: 820, percent: 15.8, color: '#0F172A' },
        { name: 'Novi Početak', shortName: 'NP', votes: 680, percent: 13.1, color: '#10B981' },
        { name: 'Demokratska Fronta', shortName: 'DF', votes: 510, percent: 9.8, color: '#D97706' },
        { name: 'Ostali', shortName: 'Ostali', votes: 990, percent: 19.0, color: '#64748B' }
      ]
    }
  ]
};

// State store
let electionState: ElectionState = { ...initialElectionState };

// Utility to load data from JSON
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      electionState = JSON.parse(content);
      console.log('Successfully loaded election data from election_state.json');
    } else {
      saveData();
    }
  } catch (error) {
    console.error('Failed to load election data, using initial state:', error);
  }
}

// Utility to save data to JSON
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(electionState, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save election data:', error);
  }
}

// Recalculate candidate percentages for Predsjedništvo
function recalculatePresidency() {
  const races = ['bosnjacki', 'hrvatski', 'srpski'] as const;
  races.forEach(race => {
    const list = electionState.predsjednistvo[race];
    const totalVotes = list.reduce((sum, c) => sum + c.votes, 0);
    if (totalVotes > 0) {
      list.forEach(c => {
        c.percent = Math.round((c.votes / totalVotes) * 1000) / 10;
      });
    } else {
      list.forEach(c => { c.percent = 0; });
    }
  });
}

// Recalculate party percentages for parliaments
function recalculateParliaments() {
  const parliaments = ['parlamentBiH', 'parlamentFBiH'] as const;
  parliaments.forEach(parlKey => {
    const list = electionState[parlKey];
    const totalVotes = list.reduce((sum, p) => sum + p.votes, 0);
    if (totalVotes > 0) {
      list.forEach(p => {
        p.percent = Math.round((p.votes / totalVotes) * 1000) / 10;
      });
    } else {
      list.forEach(p => { p.percent = 0; });
    }
  });
}

// Recalculate canton percentages
function recalculateCantons() {
  electionState.kantoni.forEach(canton => {
    const totalVotes = canton.parties.reduce((sum, p) => sum + p.votes, 0);
    if (totalVotes > 0) {
      canton.parties.forEach(p => {
        p.percent = Math.round((p.votes / totalVotes) * 1000) / 10;
      });
    } else {
      canton.parties.forEach(p => { p.percent = 0; });
    }
  });
}

// Global recalculate helper
function recalculateAll() {
  recalculatePresidency();
  recalculateParliaments();
  recalculateCantons();
  electionState.lastUpdated = new Date().toISOString();
}

// Load initial data
loadData();

// Live Simulator Background Interval
let simulationInterval: NodeJS.Timeout | null = null;

function runSimulationTick() {
  if (!electionState.simulationActive) return;

  // 1. Increase processed polling stations by small random amount
  // Speed controls the increment (speed 1 to 5)
  const step = (Math.random() * 0.8 + 0.1) * electionState.simulationSpeed;
  electionState.processedPollingStationsPercent = Math.min(
    100,
    Math.round((electionState.processedPollingStationsPercent + step) * 100) / 100
  );

  // If we reach 100%, stop the simulation
  if (electionState.processedPollingStationsPercent >= 100) {
    electionState.simulationActive = false;
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
  }

  // 2. Increase turnout slightly up to maximum of around 58%
  if (electionState.overallTurnoutPercent < 58) {
    const turnoutStep = (Math.random() * 0.1) * electionState.simulationSpeed;
    electionState.overallTurnoutPercent = Math.min(
      65,
      Math.round((electionState.overallTurnoutPercent + turnoutStep) * 100) / 100
    );
  }

  // 3. Add random votes to all candidates and parties
  const scale = electionState.simulationSpeed * 350;

  // Presidency Bosnjacki (SDA, SDP, SBiH getting votes)
  electionState.predsjednistvo.bosnjacki[0].votes += Math.floor(Math.random() * scale * 1.1);
  electionState.predsjednistvo.bosnjacki[1].votes += Math.floor(Math.random() * scale * 1.0);
  electionState.predsjednistvo.bosnjacki[2].votes += Math.floor(Math.random() * scale * 0.4);

  // Presidency Hrvatski
  electionState.predsjednistvo.hrvatski[0].votes += Math.floor(Math.random() * scale * 1.0);
  electionState.predsjednistvo.hrvatski[1].votes += Math.floor(Math.random() * scale * 0.95);
  electionState.predsjednistvo.hrvatski[2].votes += Math.floor(Math.random() * scale * 0.15);

  // Presidency Srpski
  electionState.predsjednistvo.srpski[0].votes += Math.floor(Math.random() * scale * 1.1);
  electionState.predsjednistvo.srpski[1].votes += Math.floor(Math.random() * scale * 0.9);
  electionState.predsjednistvo.srpski[2].votes += Math.floor(Math.random() * scale * 0.45);

  // Parliament BiH
  electionState.parlamentBiH.forEach(p => {
    // Give some random weight multiplier
    let mult = 1.0;
    if (p.shortName === 'SDA') mult = 1.2;
    if (p.shortName === 'SNSD') mult = 1.1;
    if (p.shortName === 'SDP BiH') mult = 1.0;
    if (p.shortName === 'HDZ BiH') mult = 0.8;
    p.votes += Math.floor((Math.random() * scale * 0.6 + 20) * mult);
  });

  // Parliament FBiH
  electionState.parlamentFBiH.forEach(p => {
    let mult = 1.0;
    if (p.shortName === 'SDA') mult = 1.25;
    if (p.shortName === 'SDP BiH') mult = 1.15;
    if (p.shortName === 'HDZ BiH') mult = 0.9;
    p.votes += Math.floor((Math.random() * scale * 0.6 + 20) * mult);
  });

  // Kantoni
  electionState.kantoni.forEach(canton => {
    // Increase canton processed station rate
    const cantStep = (Math.random() * 0.9 + 0.1) * electionState.simulationSpeed;
    canton.processedPercent = Math.min(100, Math.round((canton.processedPercent + cantStep) * 100) / 100);

    // Increase votes for canton parties
    canton.parties.forEach(p => {
      let weight = 1.0;
      if (p.shortName === 'SDA') weight = 1.2;
      if (p.shortName === 'HDZ BiH') weight = 1.1;
      p.votes += Math.floor((Math.random() * scale * 0.15 + 5) * weight);
    });
  });

  // 4. Recalculate percentages & save
  recalculateAll();
  saveData();
}

// Start interval if simulation is active
if (electionState.simulationActive) {
  simulationInterval = setInterval(runSimulationTick, 3000);
}

// API Routes
app.get('/api/election-data', (req, res) => {
  res.json({
    totalVoters: electionState.totalVoters,
    overallTurnoutPercent: electionState.overallTurnoutPercent,
    processedPollingStationsPercent: electionState.processedPollingStationsPercent,
    lastUpdated: electionState.lastUpdated,
    statusMessage: electionState.statusMessage,
    simulationActive: electionState.simulationActive,
    simulationSpeed: electionState.simulationSpeed,
    predsjednistvo: electionState.predsjednistvo,
    parlamentBiH: electionState.parlamentBiH,
    parlamentFBiH: electionState.parlamentFBiH,
    kantoni: electionState.kantoni
  });
});

// Admin auth check endpoint
app.post('/api/admin/auth', (req, res) => {
  const { password } = req.body;
  if (password === electionState.adminPassword) {
    res.json({ success: true, token: 'session_token_izbori_2026' });
  } else {
    res.status(401).json({ success: false, message: 'Pogrešna lozinka!' });
  }
});

// Update standard settings
app.post('/api/admin/settings', (req, res) => {
  const { password, newPassword, statusMessage, totalVoters, overallTurnoutPercent, processedPollingStationsPercent } = req.body;
  
  if (password !== electionState.adminPassword) {
    return res.status(401).json({ success: false, message: 'Pogrešna admin lozinka!' });
  }

  if (newPassword && newPassword.trim().length >= 4) {
    electionState.adminPassword = newPassword.trim();
  }
  if (statusMessage !== undefined) {
    electionState.statusMessage = statusMessage;
  }
  if (totalVoters !== undefined) {
    electionState.totalVoters = Number(totalVoters);
  }
  if (overallTurnoutPercent !== undefined) {
    electionState.overallTurnoutPercent = Number(overallTurnoutPercent);
  }
  if (processedPollingStationsPercent !== undefined) {
    electionState.processedPollingStationsPercent = Number(processedPollingStationsPercent);
  }

  recalculateAll();
  saveData();
  res.json({ success: true, message: 'Postavke uspješno ažurirane!' });
});

// Single candidate vote manual update
app.post('/api/admin/update-votes', (req, res) => {
  const { password, type, candidateId, partyShort, cantonId, votes } = req.body;

  if (password !== electionState.adminPassword) {
    return res.status(401).json({ success: false, message: 'Pogrešna admin lozinka!' });
  }

  const voteNum = Number(votes);
  if (isNaN(voteNum) || voteNum < 0) {
    return res.status(400).json({ success: false, message: 'Nevažeći broj glasova.' });
  }

  if (type === 'predsjednistvo') {
    // Find candidate across races
    let found = false;
    for (const race of ['bosnjacki', 'hrvatski', 'srpski'] as const) {
      const cand = electionState.predsjednistvo[race].find(c => c.id === candidateId);
      if (cand) {
        cand.votes = voteNum;
        found = true;
        break;
      }
    }
    if (!found) return res.status(404).json({ success: false, message: 'Kandidat nije pronađen.' });
  } 
  else if (type === 'parlamentBiH') {
    const party = electionState.parlamentBiH.find(p => p.shortName === partyShort);
    if (!party) return res.status(404).json({ success: false, message: 'Stranka nije pronađena u Parlamentu BiH.' });
    party.votes = voteNum;
  } 
  else if (type === 'parlamentFBiH') {
    const party = electionState.parlamentFBiH.find(p => p.shortName === partyShort);
    if (!party) return res.status(404).json({ success: false, message: 'Stranka nije pronađena u Parlamentu FBiH.' });
    party.votes = voteNum;
  } 
  else if (type === 'canton') {
    const canton = electionState.kantoni.find(c => c.id === Number(cantonId));
    if (!canton) return res.status(404).json({ success: false, message: 'Kanton nije pronađen.' });
    const party = canton.parties.find(p => p.shortName === partyShort);
    if (!party) return res.status(404).json({ success: false, message: 'Stranka nije pronađena u kantonu.' });
    party.votes = voteNum;
  } else {
    return res.status(400).json({ success: false, message: 'Nevažeći tip utrke.' });
  }

  recalculateAll();
  saveData();
  res.json({ success: true, data: electionState });
});

// Update Canton meta
app.post('/api/admin/update-canton-meta', (req, res) => {
  const { password, cantonId, processedPercent, turnoutPercent } = req.body;

  if (password !== electionState.adminPassword) {
    return res.status(401).json({ success: false, message: 'Pogrešna admin lozinka!' });
  }

  const canton = electionState.kantoni.find(c => c.id === Number(cantonId));
  if (!canton) return res.status(404).json({ success: false, message: 'Kanton nije pronađen.' });

  if (processedPercent !== undefined) canton.processedPercent = Number(processedPercent);
  if (turnoutPercent !== undefined) canton.turnoutPercent = Number(turnoutPercent);

  recalculateAll();
  saveData();
  res.json({ success: true, data: electionState });
});

// Toggle simulation
app.post('/api/admin/toggle-simulation', (req, res) => {
  const { password, active, speed } = req.body;

  if (password !== electionState.adminPassword) {
    return res.status(401).json({ success: false, message: 'Pogrešna admin lozinka!' });
  }

  if (active !== undefined) {
    electionState.simulationActive = !!active;
  }
  if (speed !== undefined) {
    electionState.simulationSpeed = Math.max(1, Math.min(5, Number(speed)));
  }

  // Clear existing interval
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  // Set new interval if active
  if (electionState.simulationActive) {
    simulationInterval = setInterval(runSimulationTick, 3000);
  }

  recalculateAll();
  saveData();
  res.json({ success: true, simulationActive: electionState.simulationActive, simulationSpeed: electionState.simulationSpeed });
});

// Reset simulation or votes back to seed/empty values
app.post('/api/admin/reset-data', (req, res) => {
  const { password, mode } = req.body;

  if (password !== electionState.adminPassword) {
    return res.status(401).json({ success: false, message: 'Pogrešna admin lozinka!' });
  }

  if (mode === 'seed') {
    electionState = { ...initialElectionState, lastUpdated: new Date().toISOString() };
  } else if (mode === 'zero') {
    // Set all votes to 0 and processed percentage to 0
    electionState.processedPollingStationsPercent = 0;
    electionState.overallTurnoutPercent = 0;

    const races = ['bosnjacki', 'hrvatski', 'srpski'] as const;
    races.forEach(race => {
      electionState.predsjednistvo[race].forEach(c => { c.votes = 0; c.percent = 0; });
    });

    electionState.parlamentBiH.forEach(p => { p.votes = 0; p.percent = 0; p.estimatedSeats = 0; });
    electionState.parlamentFBiH.forEach(p => { p.votes = 0; p.percent = 0; p.estimatedSeats = 0; });

    electionState.kantoni.forEach(canton => {
      canton.processedPercent = 0;
      canton.turnoutPercent = 0;
      canton.parties.forEach(p => { p.votes = 0; p.percent = 0; });
    });
  }

  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  electionState.simulationActive = false;

  recalculateAll();
  saveData();
  res.json({ success: true, data: electionState });
});

// Start integration server with Vite
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = process.env.PORT || 3000;

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    
    app.use(vite.middlewares);
    
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${port}`);
  });
}

startServer();
