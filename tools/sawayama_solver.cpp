#include <algorithm>
#include <array>
#include <atomic>
#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>
#include <thread>
#include <unordered_set>
#include <utility>
#include <vector>

namespace {

using Card = std::uint8_t;
constexpr Card NO_CARD = 255;

int suit(Card card) { return card / 13; }
int rank(Card card) { return card % 13 + 1; }
bool red(Card card) { return suit(card) == 1 || suit(card) == 2; }

bool stacks_on(Card card, Card destination) {
  return rank(destination) == rank(card) + 1 && red(card) != red(destination);
}

const char* suit_name(int value) {
  static constexpr std::array<const char*, 4> names{"clubs", "diamonds", "hearts", "spades"};
  return names.at(static_cast<std::size_t>(value));
}

std::string card_id(Card card) {
  return std::string(suit_name(suit(card))) + "-" + std::to_string(rank(card));
}

struct OriginalRandom {
  std::uint64_t state0;
  std::uint64_t state1;

  static std::uint64_t mix(std::uint64_t value) {
    value ^= value >> 33;
    value *= 18397679294719823053ULL;
    value ^= value >> 33;
    value *= 14181476777654086739ULL;
    value ^= value >> 33;
    return value;
  }

  explicit OriginalRandom(std::uint64_t seed) {
    if (seed == 0) throw std::invalid_argument("seed must be non-zero");
    state0 = mix(seed);
    state1 = mix(state0);
  }

  std::uint64_t next() {
    std::uint64_t x = state0;
    const std::uint64_t y = state1;
    state0 = y;
    x ^= x << 23;
    x ^= x >> 17;
    x ^= y;
    x ^= y >> 26;
    state1 = x;
    return state0 + state1;
  }

  std::size_t bounded(std::size_t maximum) {
    return static_cast<std::size_t>(next() % maximum);
  }
};

struct Column {
  std::vector<Card> cards;
  std::uint8_t stable_pile_id = 0;
};

struct State {
  std::array<Column, 7> columns;
  std::vector<Card> stock;
  std::vector<Card> waste;
  std::array<Card, 4> foundations{};
  Card free_cell = NO_CARD;
};

enum class ProofKind {
  draw,
  tableau_to_tableau,
  waste_to_tableau,
  free_to_tableau,
  to_free,
  to_foundation,
};

enum class ProofZone { none, tableau, waste, free_cell };

struct ProofAction {
  ProofKind kind = ProofKind::draw;
  ProofZone source_zone = ProofZone::none;
  std::uint8_t source_pile = 255;
  std::uint8_t destination_pile = 255;
  Card card = NO_CARD;
  std::array<Card, 3> drawn{NO_CARD, NO_CARD, NO_CARD};
  std::uint8_t drawn_count = 0;
  bool automatic = false;
};

struct Child {
  State state;
  std::vector<ProofAction> actions;
};

ProofAction foundation_action(ProofZone zone, std::uint8_t source_pile, Card card, bool automatic) {
  ProofAction action;
  action.kind = ProofKind::to_foundation;
  action.source_zone = zone;
  action.source_pile = source_pile;
  action.card = card;
  action.automatic = automatic;
  return action;
}

bool opening_is_valid(const std::array<Card, 7>& exposed) {
  for (Card card : exposed) {
    if (rank(card) == 1) return false;
  }
  for (std::size_t left = 0; left < exposed.size(); ++left) {
    for (std::size_t right = left + 1; right < exposed.size(); ++right) {
      if (red(exposed[left]) != red(exposed[right])
          && std::abs(rank(exposed[left]) - rank(exposed[right])) == 1) {
        return false;
      }
    }
  }
  return true;
}

State create_deal(std::uint64_t seed) {
  OriginalRandom random(seed);
  std::array<Card, 52> deck{};
  for (int index = 0; index < 52; ++index) deck[index] = static_cast<Card>(index);

  constexpr std::array<int, 7> exposed_indices{51, 44, 38, 33, 29, 26, 24};
  for (;;) {
    for (std::size_t index = deck.size() - 1; index > 0; --index) {
      std::swap(deck[index], deck[random.bounded(index + 1)]);
    }
    std::array<Card, 7> exposed{};
    for (std::size_t i = 0; i < exposed.size(); ++i) exposed[i] = deck[exposed_indices[i]];
    if (opening_is_valid(exposed)) break;
  }

  State state;
  for (std::size_t column = 0; column < state.columns.size(); ++column) {
    state.columns[column].stable_pile_id = static_cast<std::uint8_t>(column);
  }

  int cursor = 51;
  for (int row = 0; row < 7; ++row) {
    for (int column = row; column < 7; ++column) {
      state.columns[static_cast<std::size_t>(column)].cards.push_back(deck[cursor--]);
    }
  }
  state.stock.assign(deck.begin(), deck.begin() + cursor + 1);
  return state;
}

bool foundation_ready(const State& state, Card card) {
  return state.foundations[suit(card)] + 1 == rank(card);
}

bool safe_for_foundation(const State& state, Card card) {
  if (!foundation_ready(state, card)) return false;
  if (rank(card) <= 2) return true;

  int lowest_next_opposite = 14;
  for (int other = 0; other < 4; ++other) {
    const bool other_red = other == 1 || other == 2;
    if (other_red != red(card) && state.foundations[other] < 13) {
      lowest_next_opposite = std::min(lowest_next_opposite,
                                      static_cast<int>(state.foundations[other]) + 1);
    }
  }
  return rank(card) <= lowest_next_opposite;
}

std::optional<ProofAction> move_one_safe_foundation(State& state) {
  for (auto& column : state.columns) {
    if (!column.cards.empty() && safe_for_foundation(state, column.cards.back())) {
      const Card card = column.cards.back();
      column.cards.pop_back();
      ++state.foundations[suit(card)];
      return foundation_action(ProofZone::tableau, column.stable_pile_id, card, true);
    }
  }
  if (!state.waste.empty() && safe_for_foundation(state, state.waste.back())) {
    const Card card = state.waste.back();
    state.waste.pop_back();
    ++state.foundations[suit(card)];
    return foundation_action(ProofZone::waste, 255, card, true);
  }
  if (state.free_cell != NO_CARD && safe_for_foundation(state, state.free_cell)) {
    const Card card = state.free_cell;
    state.free_cell = NO_CARD;
    ++state.foundations[suit(card)];
    return foundation_action(ProofZone::free_cell, 255, card, true);
  }
  return std::nullopt;
}

bool cards_less(const std::vector<Card>& left, const std::vector<Card>& right) {
  const std::size_t shared = std::min(left.size(), right.size());
  for (std::size_t index = 0; index < shared; ++index) {
    if (left[index] != right[index]) return left[index] < right[index];
  }
  return left.size() < right.size();
}

std::vector<ProofAction> normalize(State& state) {
  std::vector<ProofAction> actions;
  while (const auto action = move_one_safe_foundation(state)) {
    actions.push_back(*action);
  }
  std::sort(state.columns.begin(), state.columns.end(), [](const Column& left, const Column& right) {
    if (left.cards != right.cards) return cards_less(left.cards, right.cards);
    return left.stable_pile_id < right.stable_pile_id;
  });
  return actions;
}

bool won(const State& state) {
  int total = 0;
  for (Card value : state.foundations) total += value;
  return total == 52;
}

std::uint64_t state_hash(const State& state) {
  std::uint64_t hash = 14695981039346656037ULL;
  auto add = [&](std::uint8_t value) {
    hash ^= value;
    hash *= 1099511628211ULL;
  };
  for (Card foundation : state.foundations) add(foundation);
  add(state.free_cell);
  add(static_cast<Card>(state.stock.size()));
  for (Card card : state.stock) add(card);
  add(static_cast<Card>(state.waste.size()));
  for (Card card : state.waste) add(card);
  for (const auto& column : state.columns) {
    add(static_cast<Card>(column.cards.size()));
    for (Card card : column.cards) add(card);
  }
  return hash;
}

bool visible_draw_card_playable(const State& state, Card card) {
  if (foundation_ready(state, card)) return true;
  for (const auto& column : state.columns) {
    if (!column.cards.empty() && stacks_on(card, column.cards.back())) return true;
  }
  return false;
}

bool ordered_tail(const std::vector<Card>& column, std::size_t start) {
  for (std::size_t index = start + 1; index < column.size(); ++index) {
    if (!stacks_on(column[index], column[index - 1])) return false;
  }
  return true;
}

void add_child(std::vector<Child>& children, State child, ProofAction explicit_action) {
  std::vector<ProofAction> actions;
  actions.push_back(std::move(explicit_action));
  auto normalized = normalize(child);
  actions.insert(actions.end(), normalized.begin(), normalized.end());
  children.push_back({std::move(child), std::move(actions)});
}

std::vector<Child> children_of(const State& state) {
  std::vector<Child> children;
  children.reserve(64);

  // Drawing is a forced, single-pass action in Hikone.
  if (!state.stock.empty()) {
    State child = state;
    std::vector<Card> drawn;
    for (int count = 0; count < 3 && !child.stock.empty(); ++count) {
      drawn.push_back(child.stock.back());
      child.stock.pop_back();
    }
    if (drawn.size() == 3 && !visible_draw_card_playable(state, drawn[2])) {
      std::swap(drawn[0], drawn[2]);
    }
    child.waste.insert(child.waste.end(), drawn.begin(), drawn.end());

    ProofAction action;
    action.kind = ProofKind::draw;
    action.drawn_count = static_cast<std::uint8_t>(drawn.size());
    for (std::size_t index = 0; index < drawn.size(); ++index) action.drawn[index] = drawn[index];
    add_child(children, std::move(child), std::move(action));
  }

  // Optional manual foundation moves preserve completeness when a safe auto move
  // is unavailable but advancing a suit is still strategically necessary.
  for (std::size_t source = 0; source < state.columns.size(); ++source) {
    if (!state.columns[source].cards.empty()) {
      const Card card = state.columns[source].cards.back();
      if (foundation_ready(state, card)) {
        State child = state;
        child.columns[source].cards.pop_back();
        ++child.foundations[suit(card)];
        add_child(
          children,
          std::move(child),
          foundation_action(ProofZone::tableau, state.columns[source].stable_pile_id, card, false)
        );
      }
    }
  }
  if (!state.waste.empty() && foundation_ready(state, state.waste.back())) {
    State child = state;
    const Card card = child.waste.back();
    child.waste.pop_back();
    ++child.foundations[suit(card)];
    add_child(children, std::move(child), foundation_action(ProofZone::waste, 255, card, false));
  }
  if (state.free_cell != NO_CARD && foundation_ready(state, state.free_cell)) {
    State child = state;
    const Card card = child.free_cell;
    child.free_cell = NO_CARD;
    ++child.foundations[suit(card)];
    add_child(children, std::move(child), foundation_action(ProofZone::free_cell, 255, card, false));
  }

  // Tableau runs may move as a unit; any card may occupy an empty column.
  for (std::size_t source = 0; source < state.columns.size(); ++source) {
    const auto& source_column = state.columns[source];
    for (std::size_t start = 0; start < source_column.cards.size(); ++start) {
      if (!ordered_tail(source_column.cards, start)) continue;
      const Card moving = source_column.cards[start];
      for (std::size_t destination = 0; destination < state.columns.size(); ++destination) {
        if (source == destination) continue;
        const auto& destination_column = state.columns[destination];
        if (destination_column.cards.empty() && start == 0) continue; // canonical no-op
        if (!destination_column.cards.empty() && !stacks_on(moving, destination_column.cards.back())) continue;

        State child = state;
        auto& child_source = child.columns[source].cards;
        auto& child_destination = child.columns[destination].cards;
        child_destination.insert(child_destination.end(), child_source.begin() + static_cast<std::ptrdiff_t>(start), child_source.end());
        child_source.erase(child_source.begin() + static_cast<std::ptrdiff_t>(start), child_source.end());

        ProofAction action;
        action.kind = ProofKind::tableau_to_tableau;
        action.source_pile = source_column.stable_pile_id;
        action.destination_pile = destination_column.stable_pile_id;
        action.card = moving;
        add_child(children, std::move(child), std::move(action));
      }
    }
  }

  if (!state.waste.empty()) {
    const Card card = state.waste.back();
    for (std::size_t destination = 0; destination < state.columns.size(); ++destination) {
      const auto& destination_column = state.columns[destination];
      if (!destination_column.cards.empty() && !stacks_on(card, destination_column.cards.back())) continue;
      State child = state;
      child.waste.pop_back();
      child.columns[destination].cards.push_back(card);

      ProofAction action;
      action.kind = ProofKind::waste_to_tableau;
      action.source_zone = ProofZone::waste;
      action.destination_pile = destination_column.stable_pile_id;
      action.card = card;
      add_child(children, std::move(child), std::move(action));
    }
  }

  if (state.free_cell != NO_CARD) {
    const Card card = state.free_cell;
    for (std::size_t destination = 0; destination < state.columns.size(); ++destination) {
      const auto& destination_column = state.columns[destination];
      if (!destination_column.cards.empty() && !stacks_on(card, destination_column.cards.back())) continue;
      State child = state;
      child.free_cell = NO_CARD;
      child.columns[destination].cards.push_back(card);

      ProofAction action;
      action.kind = ProofKind::free_to_tableau;
      action.source_zone = ProofZone::free_cell;
      action.destination_pile = destination_column.stable_pile_id;
      action.card = card;
      add_child(children, std::move(child), std::move(action));
    }
  }

  // The stock slot becomes the one-card free cell only after the stock is empty.
  if (state.stock.empty() && state.free_cell == NO_CARD) {
    for (std::size_t source = 0; source < state.columns.size(); ++source) {
      if (state.columns[source].cards.empty()) continue;
      State child = state;
      const Card card = child.columns[source].cards.back();
      child.free_cell = card;
      child.columns[source].cards.pop_back();

      ProofAction action;
      action.kind = ProofKind::to_free;
      action.source_zone = ProofZone::tableau;
      action.source_pile = state.columns[source].stable_pile_id;
      action.card = card;
      add_child(children, std::move(child), std::move(action));
    }
    if (!state.waste.empty()) {
      State child = state;
      const Card card = child.waste.back();
      child.free_cell = card;
      child.waste.pop_back();

      ProofAction action;
      action.kind = ProofKind::to_free;
      action.source_zone = ProofZone::waste;
      action.card = card;
      add_child(children, std::move(child), std::move(action));
    }
  }

  // Prefer children that have advanced further toward victory.
  std::sort(children.begin(), children.end(), [](const Child& left, const Child& right) {
    const int left_foundations = left.state.foundations[0] + left.state.foundations[1]
      + left.state.foundations[2] + left.state.foundations[3];
    const int right_foundations = right.state.foundations[0] + right.state.foundations[1]
      + right.state.foundations[2] + right.state.foundations[3];
    if (left_foundations != right_foundations) return left_foundations < right_foundations;
    return left.state.stock.size() > right.state.stock.size();
  });
  return children;
}

enum class Result { solved, unsolvable, undetermined };

struct SearchResult {
  Result result;
  std::uint64_t nodes;
  std::vector<ProofAction> proof;
};

constexpr std::size_t MAX_SEARCH_DEPTH = 1024;

struct DfsSearchContext {
  std::uint64_t budget = 0;
  std::uint64_t nodes = 0;
  bool hit_budget = false;
  bool hit_depth_limit = false;
  std::unordered_set<std::uint64_t> visited;
};

struct DfsFrame {
  State state;
  std::vector<Child> children;
  std::size_t next_child = 0;
  std::size_t depth = 0;
  std::size_t restore_path_size = 0;
  bool entered = false;
};

SearchResult solve(std::uint64_t seed, std::uint64_t budget) {
  State initial = create_deal(seed);
  std::vector<ProofAction> path = normalize(initial);

  DfsSearchContext context;
  context.budget = budget;
  context.visited.reserve(static_cast<std::size_t>(std::min<std::uint64_t>(budget, 500'000)));
  context.visited.insert(state_hash(initial));

  std::vector<DfsFrame> stack;
  stack.reserve(MAX_SEARCH_DEPTH + 1);
  stack.push_back({std::move(initial), {}, 0, 0, 0, false});

  while (!stack.empty()) {
    DfsFrame& frame = stack.back();

    if (!frame.entered) {
      ++context.nodes;
      if (won(frame.state)) {
        return {Result::solved, context.nodes, std::move(path)};
      }
      if (context.nodes >= context.budget) {
        context.hit_budget = true;
        break;
      }
      if (frame.depth >= MAX_SEARCH_DEPTH) {
        context.hit_depth_limit = true;
        const std::size_t restore_path_size = frame.restore_path_size;
        stack.pop_back();
        path.resize(restore_path_size);
        continue;
      }

      auto generated = children_of(frame.state);
      frame.children.reserve(generated.size());

      // Preserve the old iterative DFS discovery semantics without retaining
      // the whole global frontier: register every sibling before exploring the
      // last accepted child first.
      for (auto& child : generated) {
        if (context.visited.insert(state_hash(child.state)).second) {
          frame.children.push_back(std::move(child));
        }
      }
      frame.next_child = frame.children.size();
      frame.entered = true;
    }

    if (frame.next_child == 0) {
      const std::size_t restore_path_size = frame.restore_path_size;
      stack.pop_back();
      path.resize(restore_path_size);
      continue;
    }

    Child child = std::move(frame.children[--frame.next_child]);
    const std::size_t previous_path_size = path.size();
    path.insert(path.end(), child.actions.begin(), child.actions.end());
    const std::size_t child_depth = frame.depth + 1;
    stack.push_back({std::move(child.state), {}, 0, child_depth, previous_path_size, false});
  }

  if (context.hit_budget || context.hit_depth_limit) {
    return {Result::undetermined, context.nodes, {}};
  }
  return {Result::unsolvable, context.nodes, {}};
}

std::uint64_t parse_u64(const std::string& value, const char* name) {
  std::size_t consumed = 0;
  const auto result = std::stoull(value, &consumed, 0);
  if (consumed != value.size() || result == 0) throw std::invalid_argument(std::string("invalid ") + name);
  return result;
}

std::string result_name(Result result) {
  if (result == Result::solved) return "SOLVED";
  if (result == Result::unsolvable) return "UNSOLVABLE";
  return "UNDETERMINED";
}

const char* zone_name(ProofZone zone) {
  if (zone == ProofZone::tableau) return "tableau";
  if (zone == ProofZone::waste) return "waste";
  if (zone == ProofZone::free_cell) return "free";
  throw std::logic_error("proof action has no source zone");
}

void write_source_json(std::ostream& output, ProofZone zone, std::uint8_t pile) {
  output << "{\"zone\":\"" << zone_name(zone) << "\"";
  if (zone == ProofZone::tableau) output << ",\"pile\":" << static_cast<unsigned>(pile);
  output << "}";
}

void write_action_json(std::ostream& output, const ProofAction& action) {
  switch (action.kind) {
    case ProofKind::draw:
      output << "{\"kind\":\"draw\",\"cardIds\":[";
      for (std::size_t index = 0; index < action.drawn_count; ++index) {
        if (index != 0) output << ',';
        output << '"' << card_id(action.drawn[index]) << '"';
      }
      output << "]}";
      return;
    case ProofKind::tableau_to_tableau:
      output << "{\"kind\":\"tableau-to-tableau\",\"sourcePile\":"
             << static_cast<unsigned>(action.source_pile)
             << ",\"startCardId\":\"" << card_id(action.card)
             << "\",\"destinationPile\":" << static_cast<unsigned>(action.destination_pile) << "}";
      return;
    case ProofKind::waste_to_tableau:
      output << "{\"kind\":\"waste-to-tableau\",\"cardId\":\"" << card_id(action.card)
             << "\",\"destinationPile\":" << static_cast<unsigned>(action.destination_pile) << "}";
      return;
    case ProofKind::free_to_tableau:
      output << "{\"kind\":\"free-to-tableau\",\"cardId\":\"" << card_id(action.card)
             << "\",\"destinationPile\":" << static_cast<unsigned>(action.destination_pile) << "}";
      return;
    case ProofKind::to_free:
      output << "{\"kind\":\"to-free\",\"source\":";
      write_source_json(output, action.source_zone, action.source_pile);
      output << ",\"cardId\":\"" << card_id(action.card) << "\"}";
      return;
    case ProofKind::to_foundation:
      output << "{\"kind\":\"to-foundation\",\"source\":";
      write_source_json(output, action.source_zone, action.source_pile);
      output << ",\"cardId\":\"" << card_id(action.card)
             << "\",\"suit\":\"" << suit_name(suit(action.card)) << "\"";
      if (action.automatic) output << ",\"automatic\":true";
      output << "}";
      return;
  }
}

void write_result_json(std::ostream& output, std::uint64_t seed, const SearchResult& search) {
  output << "{\"status\":\"" << result_name(search.result)
         << "\",\"seed\":" << seed
         << ",\"nodes\":" << search.nodes;
  if (search.result == Result::solved) {
    output << ",\"proof\":[";
    for (std::size_t index = 0; index < search.proof.size(); ++index) {
      if (index != 0) output << ',';
      write_action_json(output, search.proof[index]);
    }
    output << ']';
  }
  output << "}\n";
}

struct Options {
  std::optional<std::uint64_t> seed;
  bool generate_pool = false;
  bool proof_json = false;
  std::uint64_t start = 1;
  std::uint64_t count = 4096;
  std::uint64_t limit = 512;
  std::uint64_t budget = 2'000'000;
  std::uint64_t jobs = 4;
  std::string output;
};

Options parse_options(int argc, char** argv) {
  Options options;
  for (int index = 1; index < argc; ++index) {
    const std::string argument = argv[index];
    auto take = [&](const char* name) -> std::string {
      if (++index >= argc) throw std::invalid_argument(std::string("missing value for ") + name);
      return argv[index];
    };
    if (argument == "--seed") options.seed = parse_u64(take("--seed"), "seed");
    else if (argument == "--genpool") options.generate_pool = true;
    else if (argument == "--proof-json") options.proof_json = true;
    else if (argument == "--start") options.start = parse_u64(take("--start"), "start");
    else if (argument == "--count") options.count = parse_u64(take("--count"), "count");
    else if (argument == "--limit") options.limit = parse_u64(take("--limit"), "limit");
    else if (argument == "--budget") options.budget = parse_u64(take("--budget"), "budget");
    else if (argument == "--jobs") options.jobs = parse_u64(take("--jobs"), "jobs");
    else if (argument == "--out") options.output = take("--out");
    else throw std::invalid_argument("unknown argument: " + argument);
  }
  return options;
}

void write_pool(const Options& options, const std::vector<std::uint64_t>& solved,
                std::uint64_t scanned) {
  std::ofstream output(options.output, std::ios::binary);
  if (!output) throw std::runtime_error("could not open output file");
  output << "// Generated by tools/sawayama_solver.cpp. Do not edit by hand.\n";
  output << "export const WINNABLE_POOL_METADATA = Object.freeze({\n";
  output << "  scanStart: " << options.start << "n,\n";
  output << "  scanCount: " << scanned << ",\n";
  output << "  nodeBudget: " << options.budget << ",\n";
  output << "  solved: " << solved.size() << ",\n";
  output << "} as const);\n\n";
  output << "export const WINNABLE_SEEDS: readonly bigint[] = Object.freeze([\n";
  for (std::uint64_t seed : solved) output << "  " << seed << "n,\n";
  output << "]);\n";
  if (!output) throw std::runtime_error("could not write output file");
}

} // namespace

int main(int argc, char** argv) {
  try {
    const Options options = parse_options(argc, argv);
    if (options.generate_pool) {
      if (options.proof_json) throw std::invalid_argument("--proof-json is only valid with --seed");
      if (options.output.empty()) throw std::invalid_argument("--out is required with --genpool");
      std::vector<std::uint64_t> solved_seeds;
      std::uint64_t scanned = 0;
      const std::uint64_t batch_capacity = std::max<std::uint64_t>(options.jobs * 4, 16);
      while (scanned < options.count && solved_seeds.size() < options.limit) {
        const std::uint64_t batch_size = std::min(batch_capacity, options.count - scanned);
        std::vector<SearchResult> results(batch_size, {Result::undetermined, 0, {}});
        std::atomic<std::uint64_t> cursor{0};
        std::vector<std::thread> workers;
        for (std::uint64_t worker = 0; worker < std::min(options.jobs, batch_size); ++worker) {
          workers.emplace_back([&] {
            for (;;) {
              const std::uint64_t local = cursor.fetch_add(1);
              if (local >= batch_size) return;
              try {
                results[local] = solve(options.start + scanned + local, options.budget);
              } catch (const std::bad_alloc&) {
                results[local] = {Result::undetermined, options.budget, {}};
              }
            }
          });
        }
        for (auto& worker : workers) worker.join();
        for (std::uint64_t local = 0; local < batch_size; ++local) {
          if (results[local].result == Result::solved) {
            solved_seeds.push_back(options.start + scanned + local);
          }
        }
        scanned += batch_size;
        std::cerr << "scanned=" << scanned << " solved=" << solved_seeds.size() << '\n';
      }
      if (solved_seeds.size() > options.limit) solved_seeds.resize(options.limit);
      if (solved_seeds.empty()) throw std::runtime_error("no solved seeds found");
      write_pool(options, solved_seeds, scanned);
      std::cout << "WROTE " << solved_seeds.size() << " solved seeds to " << options.output << '\n';
      return solved_seeds.size() == options.limit ? 0 : 2;
    }
    if (!options.seed.has_value()) throw std::invalid_argument("use --seed N or --genpool");
    const SearchResult search = solve(*options.seed, options.budget);
    if (options.proof_json) {
      write_result_json(std::cout, *options.seed, search);
    } else {
      std::cout << result_name(search.result) << " seed=" << *options.seed
                << " nodes=" << search.nodes << " budget=" << options.budget << '\n';
    }
    return search.result == Result::solved ? 0 : (search.result == Result::unsolvable ? 3 : 4);
  } catch (const std::exception& error) {
    std::cerr << "error: " << error.what() << '\n';
    return 1;
  }
}
