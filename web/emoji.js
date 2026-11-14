/* Dictionnaire d'émojis : un par thème (catégorie BGG), un par famille de mécaniques.
 * Fichier éditable à la main. Une étiquette absente reçoit « · » et est signalée dans la console.
 * Éviter les émojis composés (séquences ZWJ, ex. 🏴‍☠️) : certaines polices les affichent en morceaux.
 */
export const EMOJI = {
  themes: {
    "Card Game": "🃏", "Fantasy": "🧙", "Economic": "💰", "Fighting": "🥊",
    "Science Fiction": "🚀", "Wargame": "⚔️", "Dice": "🎲", "Party Game": "🎉",
    "Adventure": "🧭", "Animals": "🐾", "Medieval": "🏰", "Exploration": "🗺️",
    "Deduction": "🔍", "Bluffing": "🎭", "Miniatures": "🗿", "Abstract Strategy": "♟️",
    "City Building": "🏙️", "Humor": "😂", "Ancient": "🏛️", "Horror": "👻",
    "Children's Game": "🧒", "Puzzle": "🧩", "Real-time": "⏱️", "Territory Building": "🚩",
    "Movies / TV / Radio theme": "🎬", "Nautical": "⚓", "Negotiation": "🤝", "Action / Dexterity": "🤹",
    "Civilization": "🏺", "Political": "🗳️", "Novel-based": "📖", "Transportation": "🚚",
    "Industry / Manufacturing": "🏭", "Trains": "🚂", "Mythology": "🔱", "Renaissance": "🎨",
    "Farming": "🌾", "Space Exploration": "🪐", "Murder/Mystery": "🕵️", "Racing": "🏁",
    "Video Game Theme": "🎮", "Pirates": "🦜", "Print & Play": "🖨️", "Word Game": "🔤",
    "Educational": "🎓", "Collectible Components": "💎", "Environmental": "🌱", "Sports": "⚽",
    "Comic Book / Strip": "💥", "Spies/Secret Agents": "🕶️", "Zombies": "🧟", "American West": "🤠",
    "Memory": "🧠", "Trivia": "❓", "Travel": "🧳", "Prehistoric": "🦖",
    "Aviation / Flight": "🛩️", "Number": "🔢", "Math": "➗", "Religious": "🙏",
    "Maze": "🌀", "Electronic": "🔌", "Mafia": "🎩", "Medical": "🩺",
    "Arabian": "🐪", "Mature / Adult": "🔞", "Music": "🎵", "Book": "📚",
    "Game System": "⚙️", "Expansion for Base-game": "➕",
    // Guerres : modernes 🪖, anciennes 🎖️
    "World War I": "🪖", "World War II": "🪖", "Modern Warfare": "🪖", "Vietnam War": "🪖", "Korean War": "🪖",
    "Napoleonic": "🎖️", "Post-Napoleonic": "🎖️", "Age of Reason": "🎖️", "Pike and Shot": "🎖️",
    "Civil War": "🎖️", "American Civil War": "🎖️", "American Revolutionary War": "🎖️", "American Indian Wars": "🎖️",
  },

  // Catégories qui décrivent le format ou la licence plutôt que le thème : ignorées pour choisir
  // l'émoji du thème dominant (case « Émojis »), sauf si le jeu n'a qu'elles.
  nonThematic: [
    "Card Game", "Dice", "Miniatures", "Print & Play", "Collectible Components", "Expansion for Base-game",
    "Game System", "Electronic", "Novel-based", "Movies / TV / Radio theme", "Video Game Theme",
    "Comic Book / Strip", "Book",
  ],

  families: {
    cards: { emoji: "🃏", label: "Cartes", mechanics: [
      "Hand Management", "Card Drafting", "Drafting", "Trick-taking", "Melding and Splaying", "Ladder Climbing",
      "Card Play Conflict Resolution", "Command Cards", "Move Through Deck", "Campaign / Battle Card Driven"] },
    deck: { emoji: "🎒", label: "Construction de deck / sac", mechanics: [
      "Deck, Bag, and Pool Building", "Deck Construction", "Delayed Purchase"] },
    dice: { emoji: "🎲", label: "Dés et hasard", mechanics: [
      "Dice Rolling", "Re-rolling and Locking", "Die Icon Resolution", "Push Your Luck", "Random Production",
      "Critical Hits and Failures", "Stat Check Resolution", "Roll / Spin and Move", "Cube Tower",
      "Ratio / Combat Results Table", "Different Dice Movement", "Chit-Pull System"] },
    workers: { emoji: "👷", label: "Placement d'ouvriers", mechanics: [
      "Worker Placement", "Worker Placement, Different Worker Types", "Worker Placement with Dice Workers",
      "Rondel", "Action Retrieval", "Action Drafting"] },
    actions: { emoji: "⚙️", label: "Sélection d'actions", mechanics: [
      "Action Points", "Action Queue", "Simultaneous Action Selection", "Variable Phase Order", "Action Timer",
      "Order Counters"] },
    auction: { emoji: "🔨", label: "Enchères", mechanics: [
      "Auction/Bidding", "Auction: Dutch", "Auction: Sealed Bid", "Auction: Turn Order Until Pass",
      "Auction: Once Around", "Auction: Fixed Placement", "Auction: Dutch Priority", "Auction: Dexterity",
      "Auction: English", "Constrained Bidding", "Predictive Bid", "Selection Order Bid", "Multiple-Lot Auction",
      "Closed Economy Auction", "Bribery"] },
    economy: { emoji: "💰", label: "Économie et marché", mechanics: [
      "Market", "Trading", "Income", "Commodity Speculation", "Stock Holding", "Investment", "Loans", "Ownership",
      "Contracts", "Victory Points as a Resource", "Increase Value of Unchosen Resources", "Automatic Resource Growth"] },
    patterns: { emoji: "🧩", label: "Placement et motifs", mechanics: [
      "Tile Placement", "Pattern Building", "Grid Coverage", "Enclosure", "Layering", "Map Addition",
      "Pattern Recognition", "Connections", "Map Deformation", "Map Reduction", "Pieces as Map", "Matching",
      "Multiple Maps", "Minimap Resolution"] },
    territory: { emoji: "🗺️", label: "Contrôle de territoire", mechanics: [
      "Area Majority / Influence", "Area Movement", "Zone of Control", "King of the Hill", "Area-Impulse"] },
    movement: { emoji: "🚶", label: "Déplacement", mechanics: [
      "Grid Movement", "Point to Point Movement", "Hexagon Grid", "Square Grid", "Movement Points", "Track Movement",
      "Hidden Movement", "Measurement Movement", "Three Dimensional Movement", "Relative Movement", "Pattern Movement",
      "Moving Multiple Units", "Impulse Movement", "Movement Template", "Resource to Move", "Line of Sight",
      "Slide/Push", "Programmed Movement", "Mancala"] },
    network: { emoji: "🛤️", label: "Réseaux et livraison", mechanics: [
      "Network and Route Building", "Pick-up and Deliver", "Crayon Rail System", "Line Drawing", "Chaining"] },
    coop: { emoji: "🤝", label: "Coopération", mechanics: [
      "Cooperative Game", "Semi-Cooperative Game", "Team-Based Game", "Communication Limits"] },
    hidden: { emoji: "🎭", label: "Bluff et information cachée", mechanics: [
      "Hidden Roles", "Traitor Game", "Betting and Bluffing", "Roles with Asymmetric Information",
      "Secret Unit Deployment", "Deduction", "Targeted Clues", "Induction", "Hidden Victory Points", "Bias"] },
    conflict: { emoji: "⚔️", label: "Conflit direct", mechanics: [
      "Take That", "Player Elimination", "Kill Steal", "Static Capture", "Physical Removal", "Force Commitment",
      "Rock-Paper-Scissors", "Tug of War", "Interrupts", "Catch the Leader", "Single Loser Game",
      "Prisoner's Dilemma", "Hot Potato"] },
    social: { emoji: "🗳️", label: "Négociation et vote", mechanics: [
      "Voting", "Negotiation", "I Cut, You Choose", "Player Judge", "Alliances"] },
    story: { emoji: "📖", label: "Récit et campagne", mechanics: [
      "Storytelling", "Role Playing", "Narrative Choice / Paragraph", "Scenario / Mission / Campaign Game",
      "Legacy Game", "Events", "Action/Event"] },
    asym: { emoji: "🦸", label: "Asymétrie", mechanics: [
      "Variable Player Powers", "Once-Per-Game Abilities", "Advantage Token"] },
    scoring: { emoji: "🏆", label: "Score et fin de partie", mechanics: [
      "Set Collection", "End Game Bonuses", "Race", "Highest-Lowest Scoring", "Score-and-Reset Game",
      "Sudden Death Ending", "Finale Ending", "Elapsed Real Time Ending", "Time Track"] },
    progress: { emoji: "🔬", label: "Progression et simulation", mechanics: [
      "Tech Trees / Tech Tracks", "Simulation", "Modular Board", "Variable Set-up"] },
    realtime: { emoji: "⏱️", label: "Temps réel, adresse, party", mechanics: [
      "Real-Time", "Speed Matching", "Flicking", "Stacking and Balancing", "Acting", "Singing", "Memory",
      "Paper-and-Pencil", "Bingo"] },
    turn: { emoji: "🔄", label: "Ordre du tour", mechanics: [
      "Turn Order: Progressive", "Turn Order: Claim Action", "Turn Order: Stat-Based", "Turn Order: Pass Order",
      "Turn Order: Auction", "Turn Order: Role Order", "Turn Order: Random", "Lose a Turn", "Passed Action Token",
      "Follow"] },
    solo: { emoji: "👤", label: "Solo", mechanics: ["Solo / Solitaire Game"] },
  },
};
