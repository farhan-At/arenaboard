export class DomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function probability(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

function cleanName(value, limit) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) {
    throw new DomainError('Enter a name of 1 to ' + limit + ' characters.');
  }
  return value.trim();
}

export function createBoard(title, entries) {
  const name = cleanName(title, 64);
  if (!Array.isArray(entries) || entries.length !== 4) throw new DomainError('Register four players.');
  const players = entries.map((entry, index) => {
    if (!Number.isInteger(entry?.rating) || entry.rating < 0 || entry.rating > 3000) {
      throw new DomainError('Opening ratings must be integers from 0 to 3000.');
    }
    return {id: index + 1, name: cleanName(entry.name, 30), opening: entry.rating, rating: entry.rating, wins: 0};
  });
  if (new Set(players.map(p => p.name.toLowerCase())).size !== 4) throw new DomainError('Player names must be distinct.');
  const seeds = [...players].sort((a, b) => b.opening - a.opening || a.id - b.id);
  const pair = (id, first, second) => ({id, a: first, b: second, result: null});
  return {name, revision: 0, players, seeds: seeds.map(p => p.id),
    matches: [pair('S1', seeds[0].id, seeds[3].id), pair('S2', seeds[1].id, seeds[2].id), pair('F', null, null)]};
}

export function score(board, matchId, left, right) {
  const match = board.matches.find(m => m.id === matchId);
  if (!match) throw new DomainError('Unknown match.', 404);
  if (match.result || !match.a || !match.b) throw new DomainError('Match is closed or waiting for players.', 409);
  if (![left, right].every(n => Number.isInteger(n) && n >= 0 && n <= 999) || left === right) {
    throw new DomainError('Enter two different whole scores from 0 to 999.');
  }
  const a = board.players.find(p => p.id === match.a);
  const b = board.players.find(p => p.id === match.b);
  const chance = probability(a.rating, b.rating);
  const winner = left > right ? a : b;
  const change = Math.round(32 * (Number(left > right) - chance));
  a.rating += change;
  b.rating -= change;
  winner.wins++;
  match.result = {left, right, winner: winner.id, chance};
  if (matchId === 'S1') board.matches[2].a = winner.id;
  if (matchId === 'S2') board.matches[2].b = winner.id;
  board.revision++;
  return board;
}
