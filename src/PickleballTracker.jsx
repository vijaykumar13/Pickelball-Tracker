import React, { useState, useEffect } from 'react';
import { Trophy, Plus, TrendingUp, Calendar, Share2, X, User, Mail, Search, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useAuth } from './contexts/AuthContext';

export default function PickleballTracker() {
  const { user, signOut, signInWithGoogle } = useAuth();
  const [view, setView] = useState('court');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [draggedFromPosition, setDraggedFromPosition] = useState(null);

  const playerNameInputRef = React.useRef(null);

  // Auto-focus player name input when modal opens
  React.useEffect(() => {
    if (showNewPlayer && playerNameInputRef.current) {
      playerNameInputRef.current.focus();
    }
  }, [showNewPlayer]);

  // Handle pending action after login
  React.useEffect(() => {
    if (user && pendingAction) {
      pendingAction();
      setPendingAction(null);
      setShowLoginModal(false);
    }
  }, [user, pendingAction]);

  // Court positions for current game
  const [courtPositions, setCourtPositions] = useState({
    team1Left: null,
    team1Right: null,
    team2Left: null,
    team2Right: null
  });

  // Scores for current game
  const [currentScores, setCurrentScores] = useState({
    team1: '',
    team2: ''
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load players from Supabase
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: true });

      if (playersError) throw playersError;
      if (playersData) {
        setAllPlayers(playersData);
      }

      // Load games from Supabase
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });

      if (gamesError) throw gamesError;
      if (gamesData) {
        // Transform games data to match our format
        const transformedGames = gamesData.map(game => ({
          id: game.id,
          team1: {
            player1: playersData?.find(p => p.id === game.team1_player1_id) || null,
            player2: playersData?.find(p => p.id === game.team1_player2_id) || null,
            score: game.team1_score
          },
          team2: {
            player1: playersData?.find(p => p.id === game.team2_player1_id) || null,
            player2: playersData?.find(p => p.id === game.team2_player2_id) || null,
            score: game.team2_score
          },
          winner: game.winner,
          date: game.played_at,
          timestamp: new Date(game.created_at).getTime()
        }));
        setGames(transformedGames);

        // Calculate player stats from games
        const stats = calculatePlayerStats(transformedGames);
        setPlayers(stats);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNewPlayer = async () => {
    if (!newPlayerName.trim()) {
      alert('Please enter a player name');
      return;
    }

    try {
      // Insert player into Supabase
      const { data, error } = await supabase
        .from('players')
        .insert([{
          name: newPlayerName.trim(),
          email: newPlayerEmail.trim() || null
        }])
        .select()
        .single();

      if (error) throw error;

      const player = data;
      setAllPlayers([...allPlayers, player]);

      setNewPlayerName('');
      setNewPlayerEmail('');
      setShowNewPlayer(false);

      // Auto-select the newly created player
      if (selectedPosition) {
        setCourtPositions({
          ...courtPositions,
          [selectedPosition]: player
        });
        setShowPlayerSelect(false);
        setSelectedPosition(null);
      }
    } catch (error) {
      console.error('Error saving player:', error);
      alert('Error saving player. Please try again.');
    }
  };

  const selectPosition = (position) => {
    if (!user) {
      setPendingAction(() => () => {
        setSelectedPosition(position);
        setShowPlayerSelect(true);
        setSearchQuery('');
      });
      setShowLoginModal(true);
      return;
    }
    setSelectedPosition(position);
    setShowPlayerSelect(true);
    setSearchQuery('');
  };

  const selectPlayer = (player) => {
    setCourtPositions({
      ...courtPositions,
      [selectedPosition]: player
    });
    setShowPlayerSelect(false);
    setSelectedPosition(null);
    setSearchQuery('');
  };

  // Drag and drop handlers
  const handleDragStart = (e, player, fromPosition) => {
    setDraggedPlayer(player);
    setDraggedFromPosition(fromPosition);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, toPosition) => {
    e.preventDefault();

    if (!draggedPlayer) return;

    // Get the player currently in the target position
    const targetPlayer = courtPositions[toPosition];

    // Swap players if there's one in the target position
    if (draggedFromPosition) {
      setCourtPositions({
        ...courtPositions,
        [draggedFromPosition]: targetPlayer || null,
        [toPosition]: draggedPlayer
      });
    } else {
      // Adding from player list (not moving from court)
      setCourtPositions({
        ...courtPositions,
        [toPosition]: draggedPlayer
      });
    }

    setDraggedPlayer(null);
    setDraggedFromPosition(null);
  };

  // Filter players based on search query
  const filteredPlayers = allPlayers.filter(player =>
    player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (player.email && player.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const saveGame = async () => {
    if (!user) {
      setPendingAction(() => saveGame);
      setShowLoginModal(true);
      return;
    }

    const team1Score = parseInt(currentScores.team1);
    const team2Score = parseInt(currentScores.team2);

    // Check if at least one player per team
    const hasTeam1 = courtPositions.team1Left || courtPositions.team1Right;
    const hasTeam2 = courtPositions.team2Left || courtPositions.team2Right;

    if (!hasTeam1 || !hasTeam2 || isNaN(team1Score) || isNaN(team2Score)) {
      alert('Please add at least one player per team and enter scores');
      return;
    }

    try {
      // Insert game into Supabase
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert([{
          team1_player1_id: courtPositions.team1Left?.id || null,
          team1_player2_id: courtPositions.team1Right?.id || null,
          team2_player1_id: courtPositions.team2Left?.id || null,
          team2_player2_id: courtPositions.team2Right?.id || null,
          team1_score: team1Score,
          team2_score: team2Score,
          winner: team1Score > team2Score ? 'team1' : 'team2'
        }])
        .select()
        .single();

      if (gameError) throw gameError;

      // Create local game object for immediate UI update
      const game = {
        id: gameData.id,
        team1: {
          player1: courtPositions.team1Left,
          player2: courtPositions.team1Right,
          score: team1Score
        },
        team2: {
          player1: courtPositions.team2Left,
          player2: courtPositions.team2Right,
          score: team2Score
        },
        winner: team1Score > team2Score ? 'team1' : 'team2',
        date: gameData.played_at,
        timestamp: new Date(gameData.created_at).getTime()
      };

      const updatedGames = [game, ...games];
      setGames(updatedGames);

      // Update player stats
      const updatedPlayers = calculatePlayerStats([...updatedGames]);
      setPlayers(updatedPlayers);
    } catch (error) {
      console.error('Error saving game:', error);
      alert('Error saving game. Please try again.');
    }

    // Keep players on court, only reset scores
    setCurrentScores({ team1: '', team2: '' });
  };

  const clearCourt = () => {
    setCourtPositions({
      team1Left: null,
      team1Right: null,
      team2Left: null,
      team2Right: null
    });
    setCurrentScores({ team1: '', team2: '' });
  };

  const calculatePlayerStats = (allGames) => {
    const stats = {};

    allGames.forEach(game => {
      const team1Players = [game.team1.player1, game.team1.player2].filter(Boolean);
      const team2Players = [game.team2.player1, game.team2.player2].filter(Boolean);

      team1Players.forEach(playerObj => {
        const playerId = playerObj.id || playerObj.name;
        if (!stats[playerId]) {
          stats[playerId] = {
            player: playerObj,
            wins: 0,
            losses: 0,
            totalPoints: 0,
            gamesPlayed: 0
          };
        }
        stats[playerId].gamesPlayed++;
        stats[playerId].totalPoints += game.team1.score;
        if (game.winner === 'team1') stats[playerId].wins++;
        else stats[playerId].losses++;
      });

      team2Players.forEach(playerObj => {
        const playerId = playerObj.id || playerObj.name;
        if (!stats[playerId]) {
          stats[playerId] = {
            player: playerObj,
            wins: 0,
            losses: 0,
            totalPoints: 0,
            gamesPlayed: 0
          };
        }
        stats[playerId].gamesPlayed++;
        stats[playerId].totalPoints += game.team2.score;
        if (game.winner === 'team2') stats[playerId].wins++;
        else stats[playerId].losses++;
      });
    });

    return Object.values(stats)
      .map(stat => ({
        ...stat,
        winRate: stat.gamesPlayed > 0 ? (stat.wins / stat.gamesPlayed * 100).toFixed(1) : 0,
        avgPoints: stat.gamesPlayed > 0 ? (stat.totalPoints / stat.gamesPlayed).toFixed(1) : 0
      }))
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
  };

  const shareResults = (game) => {
    const team1Players = [game.team1.player1, game.team1.player2].filter(Boolean);
    const team2Players = [game.team2.player1, game.team2.player2].filter(Boolean);

    const team1 = team1Players.map(p => p.name).join(' & ');
    const team2 = team2Players.map(p => p.name).join(' & ');

    const text = `🏓 Pickleball Match Results\n${team1}: ${game.team1.score}\n${team2}: ${game.team2.score}\n${game.winner === 'team1' ? team1 : team2} wins! 🏆`;

    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Results copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-blue-300 text-lg tracking-wide font-sans">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-950 border-b border-blue-500">
        <div className="max-w-6xl mx-auto px-3 py-2 flex justify-between items-center">
          <h1 className="text-xl font-light tracking-tight text-blue-400">Pickleball Tracker</h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-slate-400 text-sm font-sans">{user.email}</span>
                <button
                  onClick={signOut}
                  className="text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1 text-sm font-sans"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1 text-sm font-sans"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3">
          <div className="flex gap-4">
            <button
              onClick={() => setView('court')}
              className={`py-2 text-xs font-sans tracking-wide transition-colors border-b-2 ${
                view === 'court'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-blue-400'
              }`}
            >
              COURT
            </button>
            <button
              onClick={() => setView('history')}
              className={`py-2 text-xs font-sans tracking-wide transition-colors border-b-2 ${
                view === 'history'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-blue-400'
              }`}
            >
              HISTORY
            </button>
            <button
              onClick={() => setView('leaderboard')}
              className={`py-2 text-xs font-sans tracking-wide transition-colors border-b-2 ${
                view === 'leaderboard'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-blue-400'
              }`}
            >
              LEADERBOARD
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 py-1">
        {view === 'court' && (
          <div>
            {/* Pickleball Court */}
            <div className="max-w-md mx-auto">
              {/* Court Container */}
              <div className="relative bg-white border-[3px] border-white shadow-xl">
                {/* Court - 44ft length x 20ft width (2.2:1 ratio) */}
                <div className="relative w-full" style={{ paddingBottom: '132%' }}>
                  <div className="absolute inset-0">
                    {/* White baseline and sideline borders */}
                    <div className="absolute inset-0 border-[3px] border-white shadow-inner"></div>

                    {/* Baselines */}
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-white shadow-md z-25"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white shadow-md z-25"></div>

                    {/* Full-length centerline */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-[3px] bg-white -translate-x-1/2 shadow-sm z-20"></div>

                    {/* TOP SERVICE AREAS (Team 1) - Blue */}
                    <div className="absolute top-0 left-0 w-1/2 bg-gradient-to-br from-blue-700 to-blue-800" style={{ height: '34.1%' }}></div>
                    <div className="absolute top-0 right-0 w-1/2 bg-gradient-to-br from-blue-700 to-blue-800" style={{ height: '34.1%' }}></div>

                    {/* TOP KITCHEN/NVZ (Team 1) - Orange */}
                    <div className="absolute left-0 right-0 bg-gradient-to-br from-orange-400 to-orange-500" style={{ top: '34.1%', height: '15.9%' }}></div>

                    {/* BOTTOM KITCHEN/NVZ (Team 2) - Orange */}
                    <div className="absolute left-0 right-0 bg-gradient-to-br from-orange-400 to-orange-500" style={{ bottom: '34.1%', height: '15.9%' }}></div>

                    {/* BOTTOM SERVICE AREAS (Team 2) - Blue */}
                    <div className="absolute bottom-0 left-0 w-1/2 bg-gradient-to-br from-blue-700 to-blue-800" style={{ height: '34.1%' }}></div>
                    <div className="absolute bottom-0 right-0 w-1/2 bg-gradient-to-br from-blue-700 to-blue-800" style={{ height: '34.1%' }}></div>

                    {/* Non-Volley Zone Lines (Kitchen lines) */}
                    <div className="absolute left-0 right-0 h-[3px] bg-white shadow-sm z-10" style={{ top: 'calc(34.1% - 1.5px)' }}></div>
                    <div className="absolute left-0 right-0 h-[3px] bg-white shadow-sm z-10" style={{ bottom: 'calc(34.1% - 1.5px)' }}></div>

                    {/* Net in the center */}
                    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: 'calc(50% - 3px)' }}>
                      <div className="absolute inset-0 h-[8px] bg-black opacity-20 blur-sm transform translate-y-2"></div>
                      <div className="relative h-[6px] bg-white shadow-lg overflow-hidden">
                        <div className="absolute inset-0" style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, black 0px, black 4px, white 4px, white 8px)',
                        }}></div>
                      </div>
                    </div>

                    {/* Team 1 Left Service Area */}
                    <button
                      onClick={() => selectPosition('team1Left')}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'team1Left')}
                      className="absolute top-0 left-0 w-1/2 hover:bg-white hover:bg-opacity-10 transition-all group z-15"
                      style={{ height: '34.1%' }}
                    >
                      <div className="h-full flex flex-col items-center justify-center p-2">
                        {courtPositions.team1Left ? (
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, courtPositions.team1Left, 'team1Left')}
                            className="cursor-move"
                          >
                            <div className="bg-white rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center mb-1 text-2xl md:text-3xl font-bold text-blue-600 shadow-lg">
                              {courtPositions.team1Left.name[0].toUpperCase()}
                            </div>
                            <div className="text-white font-sans text-xs md:text-sm font-bold drop-shadow-lg">{courtPositions.team1Left.name}</div>
                          </div>
                        ) : (
                          <>
                            <User size={40} className="text-white mb-1 opacity-40 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                            <span className="text-white text-xs font-sans font-bold opacity-40 group-hover:opacity-100 transition-opacity drop-shadow uppercase">Add Player</span>
                          </>
                        )}
                      </div>
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white bg-opacity-95 text-blue-600 px-2 py-1 text-[10px] font-bold font-sans rounded shadow-md">
                        T1-L
                      </div>
                    </button>

                    {/* Team 1 Right Service Area */}
                    <button
                      onClick={() => selectPosition('team1Right')}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'team1Right')}
                      className="absolute top-0 right-0 w-1/2 hover:bg-white hover:bg-opacity-10 transition-all group z-15"
                      style={{ height: '34.1%' }}
                    >
                      <div className="h-full flex flex-col items-center justify-center p-2">
                        {courtPositions.team1Right ? (
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, courtPositions.team1Right, 'team1Right')}
                            className="cursor-move"
                          >
                            <div className="bg-white rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center mb-1 text-2xl md:text-3xl font-bold text-blue-600 shadow-lg">
                              {courtPositions.team1Right.name[0].toUpperCase()}
                            </div>
                            <div className="text-white font-sans text-xs md:text-sm font-bold drop-shadow-lg">{courtPositions.team1Right.name}</div>
                          </div>
                        ) : (
                          <>
                            <User size={40} className="text-white mb-1 opacity-40 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                            <span className="text-white text-xs font-sans font-bold opacity-40 group-hover:opacity-100 transition-opacity drop-shadow uppercase">Add Player</span>
                          </>
                        )}
                      </div>
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white bg-opacity-95 text-blue-600 px-2 py-1 text-[10px] font-bold font-sans rounded shadow-md">
                        T1-R
                      </div>
                    </button>

                    {/* Team 2 Left Service Area */}
                    <button
                      onClick={() => selectPosition('team2Left')}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'team2Left')}
                      className="absolute bottom-0 left-0 w-1/2 hover:bg-white hover:bg-opacity-10 transition-all group z-15"
                      style={{ height: '34.1%' }}
                    >
                      <div className="h-full flex flex-col items-center justify-center p-2">
                        {courtPositions.team2Left ? (
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, courtPositions.team2Left, 'team2Left')}
                            className="cursor-move"
                          >
                            <div className="bg-white rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center mb-1 text-2xl md:text-3xl font-bold text-blue-600 shadow-lg">
                              {courtPositions.team2Left.name[0].toUpperCase()}
                            </div>
                            <div className="text-white font-sans text-xs md:text-sm font-bold drop-shadow-lg">{courtPositions.team2Left.name}</div>
                          </div>
                        ) : (
                          <>
                            <User size={40} className="text-white mb-1 opacity-40 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                            <span className="text-white text-xs font-sans font-bold opacity-40 group-hover:opacity-100 transition-opacity drop-shadow uppercase">Add Player</span>
                          </>
                        )}
                      </div>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white bg-opacity-95 text-blue-600 px-2 py-1 text-[10px] font-bold font-sans rounded shadow-md">
                        T2-L
                      </div>
                    </button>

                    {/* Team 2 Right Service Area */}
                    <button
                      onClick={() => selectPosition('team2Right')}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'team2Right')}
                      className="absolute bottom-0 right-0 w-1/2 hover:bg-white hover:bg-opacity-10 transition-all group z-15"
                      style={{ height: '34.1%' }}
                    >
                      <div className="h-full flex flex-col items-center justify-center p-2">
                        {courtPositions.team2Right ? (
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, courtPositions.team2Right, 'team2Right')}
                            className="cursor-move"
                          >
                            <div className="bg-white rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center mb-1 text-2xl md:text-3xl font-bold text-blue-600 shadow-lg">
                              {courtPositions.team2Right.name[0].toUpperCase()}
                            </div>
                            <div className="text-white font-sans text-xs md:text-sm font-bold drop-shadow-lg">{courtPositions.team2Right.name}</div>
                          </div>
                        ) : (
                          <>
                            <User size={40} className="text-white mb-1 opacity-40 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                            <span className="text-white text-xs font-sans font-bold opacity-40 group-hover:opacity-100 transition-opacity drop-shadow uppercase">Add Player</span>
                          </>
                        )}
                      </div>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white bg-opacity-95 text-blue-600 px-2 py-1 text-[10px] font-bold font-sans rounded shadow-md">
                        T2-R
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Scores Section */}
            <div className="mt-1.5 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-2">
                {/* Team 1 Score */}
                <div className="bg-slate-950 border border-slate-800 p-1.5">
                  <h3 className="text-blue-400 font-sans text-[9px] tracking-wide mb-1 font-bold">TEAM 1</h3>
                  <input
                    type="number"
                    value={currentScores.team1}
                    onChange={(e) => setCurrentScores({ ...currentScores, team1: e.target.value })}
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xl font-bold text-center py-1.5 focus:outline-none focus:border-blue-400 transition-colors font-sans"
                  />
                </div>

                {/* Team 2 Score */}
                <div className="bg-slate-950 border border-slate-800 p-1.5">
                  <h3 className="text-blue-400 font-sans text-[9px] tracking-wide mb-1 font-bold">TEAM 2</h3>
                  <input
                    type="number"
                    value={currentScores.team2}
                    onChange={(e) => setCurrentScores({ ...currentScores, team2: e.target.value })}
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xl font-bold text-center py-1.5 focus:outline-none focus:border-blue-400 transition-colors font-sans"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  onClick={saveGame}
                  className="bg-blue-500 text-white py-1.5 px-2 font-sans text-[10px] tracking-wide font-bold hover:bg-blue-400 transition-colors border border-blue-600 shadow-lg"
                >
                  SAVE GAME
                </button>

                <button
                  onClick={clearCourt}
                  className="bg-slate-800 text-white py-1.5 px-2 font-sans text-[10px] tracking-wide hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  CLEAR COURT
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="max-h-[calc(100vh-120px)] overflow-y-auto">
            {games.length === 0 ? (
              <div className="text-center py-8">
                <Trophy size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="text-slate-400 font-sans text-sm">No games recorded yet</p>
                <p className="text-slate-500 text-xs font-sans mt-1">Start tracking your matches</p>
              </div>
            ) : (
              <div className="space-y-2">
                {games.map(game => {
                  const team1Players = [game.team1.player1, game.team1.player2].filter(Boolean);
                  const team2Players = [game.team2.player1, game.team2.player2].filter(Boolean);
                  const team1Name = team1Players.map(p => p.name).join(' & ');
                  const team2Name = team2Players.map(p => p.name).join(' & ');

                  return (
                    <div key={game.id} className="bg-slate-950 border border-slate-800 p-3">
                      {/* Date & Time */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-sans mb-2">
                        <Calendar size={10} />
                        {new Date(game.timestamp || game.date).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </div>

                      {/* Scores */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className={`text-sm ${game.winner === 'team1' ? 'text-blue-400 font-medium' : 'text-slate-500'}`}>
                            {team1Name}
                          </div>
                          <div className={`text-2xl font-bold mt-0.5 font-sans ${game.winner === 'team1' ? 'text-white' : 'text-slate-600'}`}>
                            {game.team1.score}
                          </div>
                        </div>

                        <div className="text-slate-700 mx-4 text-lg font-light">—</div>

                        <div className="flex-1 text-right">
                          <div className={`text-sm ${game.winner === 'team2' ? 'text-blue-400 font-medium' : 'text-slate-500'}`}>
                            {team2Name}
                          </div>
                          <div className={`text-2xl font-bold mt-0.5 font-sans ${game.winner === 'team2' ? 'text-white' : 'text-slate-600'}`}>
                            {game.team2.score}
                          </div>
                        </div>
                      </div>

                      {/* Share Button */}
                      <button
                        onClick={() => shareResults(game)}
                        className="mt-3 text-[10px] font-sans tracking-wide text-slate-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                      >
                        <Share2 size={10} />
                        SHARE
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === 'leaderboard' && (
          <div className="max-h-[calc(100vh-120px)] overflow-y-auto">
            {players.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="text-slate-400 font-sans text-sm">No player statistics yet</p>
                <p className="text-slate-500 text-xs font-sans mt-1">Record some games to see rankings</p>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-slate-800 text-[10px] font-sans tracking-wide text-blue-400 font-bold">
                  <div className="col-span-1">RANK</div>
                  <div className="col-span-4">PLAYER</div>
                  <div className="col-span-2 text-center">GAMES</div>
                  <div className="col-span-2 text-center">WINS</div>
                  <div className="col-span-2 text-center">WIN %</div>
                  <div className="col-span-1 text-right">AVG</div>
                </div>

                {/* Table Rows */}
                {players.map((stat, index) => (
                  <div
                    key={stat.player.id || stat.player.name}
                    className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-slate-800 last:border-b-0 hover:bg-slate-900 transition-colors"
                  >
                    <div className="col-span-1 flex items-center">
                      {index === 0 && <Trophy size={12} className="text-blue-400 mr-1" />}
                      <span className="text-white font-bold font-sans text-xs">{index + 1}</span>
                    </div>
                    <div className="col-span-4 flex flex-col">
                      <span className="text-white font-medium text-xs">{stat.player.name}</span>
                      {stat.player.email && (
                        <span className="text-slate-500 text-[10px] font-sans mt-0.5">{stat.player.email}</span>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center justify-center text-slate-400 font-sans text-xs">
                      {stat.gamesPlayed}
                    </div>
                    <div className="col-span-2 flex items-center justify-center text-white font-bold font-sans text-xs">
                      {stat.wins}
                    </div>
                    <div className="col-span-2 flex items-center justify-center text-white font-sans text-xs">
                      {stat.winRate}%
                    </div>
                    <div className="col-span-1 flex items-center justify-end text-slate-400 font-sans text-xs">
                      {stat.avgPoints}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Player Select Modal */}
      {showPlayerSelect && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-3 z-50">
          <div className="bg-slate-950 border border-slate-800 max-w-md w-full max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-950 border-b border-slate-800 px-4 py-3 flex justify-between items-center">
              <h2 className="text-lg font-light text-blue-400">Select Player</h2>
              <button
                onClick={() => {
                  setShowPlayerSelect(false);
                  setSelectedPosition(null);
                }}
                className="text-slate-500 hover:text-blue-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              {/* Search Input */}
              <div className="mb-3 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search players by name or email..."
                  className="w-full bg-slate-900 border border-slate-700 text-white text-sm pl-10 pr-3 py-2 font-sans focus:outline-none focus:border-blue-400 transition-colors placeholder-slate-600"
                />
              </div>

              {/* New Player Button */}
              <button
                onClick={() => setShowNewPlayer(true)}
                className="w-full bg-blue-500 text-white py-2 px-4 font-sans text-xs tracking-wide font-bold hover:bg-blue-400 transition-colors flex items-center justify-center gap-2 mb-4 border border-blue-600 shadow-lg"
              >
                <Plus size={14} />
                ADD NEW PLAYER
              </button>

              {/* Existing Players */}
              {allPlayers.length === 0 ? (
                <div className="text-center py-6 text-slate-500 font-sans text-xs">
                  No players yet. Add your first player above.
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-6 text-slate-500 font-sans text-xs">
                  No players found matching "{searchQuery}"
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPlayers.map(player => (
                    <div
                      key={player.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, player, null)}
                      onClick={() => selectPlayer(player)}
                      className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-blue-400 transition-all p-3 text-left group cursor-move"
                    >
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {player.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium text-xs group-hover:text-blue-400 transition-colors">
                            {player.name}
                          </div>
                          {player.email && (
                            <div className="text-slate-500 text-[10px] font-sans mt-0.5">
                              {player.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Player Modal */}
      {showNewPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-3 z-50">
          <div className="bg-slate-950 border border-slate-800 max-w-sm w-full">
            <div className="border-b border-slate-800 px-4 py-3 flex justify-between items-center">
              <h2 className="text-lg font-light text-blue-400">New Player</h2>
              <button
                onClick={() => {
                  setShowNewPlayer(false);
                  setNewPlayerName('');
                  setNewPlayerEmail('');
                }}
                className="text-slate-500 hover:text-blue-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-slate-400 font-sans text-[10px] tracking-wide mb-1.5 flex items-center gap-1.5">
                  <User size={12} />
                  PLAYER NAME *
                </label>
                <input
                  ref={playerNameInputRef}
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full bg-slate-900 border border-slate-700 text-white text-sm px-3 py-2 font-sans focus:outline-none focus:border-blue-400 transition-colors placeholder-slate-600"
                />
              </div>

              <div>
                <label className="text-slate-400 font-sans text-[10px] tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Mail size={12} />
                  EMAIL (OPTIONAL)
                </label>
                <input
                  type="email"
                  value={newPlayerEmail}
                  onChange={(e) => setNewPlayerEmail(e.target.value)}
                  placeholder="Enter email"
                  className="w-full bg-slate-900 border border-slate-700 text-white text-sm px-3 py-2 font-sans focus:outline-none focus:border-blue-400 transition-colors placeholder-slate-600"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  onClick={() => {
                    setShowNewPlayer(false);
                    setNewPlayerName('');
                    setNewPlayerEmail('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-700 font-sans text-xs tracking-wide text-slate-400 hover:bg-slate-900 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={addNewPlayer}
                  className="flex-1 px-4 py-2 bg-blue-500 border border-blue-600 font-sans text-xs tracking-wide text-white font-bold hover:bg-blue-400 transition-colors shadow-lg"
                >
                  ADD PLAYER
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-3 z-50">
          <div className="bg-slate-950 border border-slate-800 max-w-sm w-full">
            <div className="border-b border-slate-800 px-4 py-3 flex justify-between items-center">
              <h2 className="text-lg font-light text-blue-400">Sign In Required</h2>
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setPendingAction(null);
                }}
                className="text-slate-500 hover:text-blue-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-slate-400 text-sm font-sans mb-6 text-center">
                Sign in with Google to save your games and players to the cloud.
              </p>

              <button
                onClick={signInWithGoogle}
                className="w-full bg-white text-slate-900 py-3 px-4 font-sans text-sm font-medium hover:bg-slate-100 transition-colors flex items-center justify-center gap-3 border border-slate-300 shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="mt-4 text-center">
                <p className="text-slate-500 text-xs font-sans">
                  Your data will be securely stored and synced across devices.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
