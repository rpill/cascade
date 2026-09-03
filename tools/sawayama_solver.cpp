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

struct State {
  std::array<std::vector<Card>, 7> columns;
  std::vector<Card> stock;
  std::vector<Card> waste;
  std::array<Card, 4> foundations{};
  Card free_cell = NO_CARD;
};

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
  int cursor = 51;
  for (int row = 0; row < 7; ++row) {
    for (int column = row; column < 7; ++column) {
      state.columns[column].push_back(deck[cursor--]);
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

bool move_one_safe_foundation(State& state) {
  for (auto& column : state.columns) {
    if (!column.empty() && safe_for_foundation(state, column.back())) {
      const Card card = column.back();
      column.pop_back();
      ++state.foundations[suit(card)];
      return true;
    }
  }
  if (!state.waste.empty() && safe_for_foundation(state, state.waste.back())) {
    const Card card = state.waste.back();
    state.waste.pop_back();
    ++state.foundations[suit(card)];
    return true;
  }
  if (state.free_cell != NO_CARD && safe_for_foundation(state, state.free_cell)) {
    const Card card = state.free_cell;
    state.free_cell = NO_CARD;
    ++state.foundations[suit(card)];
    return true;
  }
  return false;
}

void normalize(State& state) {
  while (move_one_safe_foundation(state)) {}
  std::sort(state.columns.begin(), state.columns.end());
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
    add(static_cast<Card>(column.size()));
    for (Card card : column) add(card);
  }
  return hash;
}

bool visible_draw_card_playable(const State& state, Card card) {
  if (foundation_ready(state, card)) return true;
  for (const auto& column : state.columns) {
    if (!column.empty() && stacks_on(card, column.back())) return true;
  }
  return false;
}

bool ordered_tail(const std::vector<Card>& column, std::size_t start) {
  for (std::size_t index = start + 1; index < column.size(); ++index) {
    if (!stacks_on(column[index], column[index - 1])) return false;
  }
  return true;
}

void add_child(std::vector<State>& children, State child) {
  normalize(child);
  children.push_back(std::move(child));
}

std::vector<State> children_of(const State& state) {
  std::vector<State> children;
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
    add_child(children, std::move(child));
  }

  // Optional manual foundation moves preserve completeness when a safe auto move
  // is unavailable but advancing a suit is still strategically necessary.
  for (std::size_t source = 0; source < state.columns.size(); ++source) {
    if (!state.columns[source].empty()) {
      const Card card = state.columns[source].back();
      if (foundation_ready(state, card)) {
        State child = state;
        child.columns[source].pop_back();
        ++child.foundations[suit(card)];
        add_child(children, std::move(child));
      }
    }
  }
  if (!state.waste.empty() && foundation_ready(state, state.waste.back())) {
    State child = state;
    const Card card = child.waste.back();
    child.waste.pop_back();
    ++child.foundations[suit(card)];
    add_child(children, std::move(child));
  }
  if (state.free_cell != NO_CARD && foundation_ready(state, state.free_cell)) {
    State child = state;
    const Card card = child.free_cell;
    child.free_cell = NO_CARD;
    ++child.foundations[suit(card)];
    add_child(children, std::move(child));
  }

  // Tableau runs may move as a unit; any card may occupy an empty column.
  for (std::size_t source = 0; source < state.columns.size(); ++source) {
    const auto& source_column = state.columns[source];
    for (std::size_t start = 0; start < source_column.size(); ++start) {
      if (!ordered_tail(source_column, start)) continue;
      const Card moving = source_column[start];
      for (std::size_t destination = 0; destination < state.columns.size(); ++destination) {
        if (source == destination) continue;
        const auto& destination_column = state.columns[destination];
        if (destination_column.empty() && start == 0) continue; // canonical no-op
        if (!destination_column.empty() && !stacks_on(moving, destination_column.back())) continue;

        State child = state;
        auto& child_source = child.columns[source];
        auto& child_destination = child.columns[destination];
        child_destination.insert(child_destination.end(), child_source.begin() + start, child_source.end());
        child_source.erase(child_source.begin() + start, child_source.end());
        add_child(children, std::move(child));
      }
    }
  }

  auto add_single_to_tableau = [&](Card card, auto remove_source) {
    for (std::size_t destination = 0; destination < state.columns.size(); ++destination) {
      const auto& column = state.columns[destination];
      if (!column.empty() && !stacks_on(card, column.back())) continue;
      State child = state;
      remove_source(child);
      child.columns[destination].push_back(card);
      add_child(children, std::move(child));
    }
  };

  if (!state.waste.empty()) {
    const Card card = state.waste.back();
    add_single_to_tableau(card, [](State& child) { child.waste.pop_back(); });
  }
  if (state.free_cell != NO_CARD) {
    const Card card = state.free_cell;
    add_single_to_tableau(card, [](State& child) { child.free_cell = NO_CARD; });
  }

  // The stock slot becomes the one-card free cell only after the stock is empty.
  if (state.stock.empty() && state.free_cell == NO_CARD) {
    for (std::size_t source = 0; source < state.columns.size(); ++source) {
      if (state.columns[source].empty()) continue;
      State child = state;
      child.free_cell = child.columns[source].back();
      child.columns[source].pop_back();
      add_child(children, std::move(child));
    }
    if (!state.waste.empty()) {
      State child = state;
      child.free_cell = child.waste.back();
      child.waste.pop_back();
      add_child(children, std::move(child));
    }
  }

  // Prefer children that have advanced further toward victory.
  std::sort(children.begin(), children.end(), [](const State& left, const State& right) {
    const int left_foundations = left.foundations[0] + left.foundations[1]
      + left.foundations[2] + left.foundations[3];
    const int right_foundations = right.foundations[0] + right.foundations[1]
      + right.foundations[2] + right.foundations[3];
    if (left_foundations != right_foundations) return left_foundations < right_foundations;
    return left.stock.size() > right.stock.size();
  });
  return children;
}

enum class Result { solved, unsolvable, undetermined };

struct SearchResult {
  Result result;
  std::uint64_t nodes;
};

SearchResult solve(std::uint64_t seed, std::uint64_t budget) {
  State initial = create_deal(seed);
  normalize(initial);
  std::vector<State> stack;
  stack.push_back(std::move(initial));
  std::unordered_set<std::uint64_t> visited;
  visited.reserve(static_cast<std::size_t>(std::min<std::uint64_t>(budget, 500'000)));
  visited.insert(state_hash(stack.back()));
  std::uint64_t nodes = 0;

  while (!stack.empty()) {
    State state = std::move(stack.back());
    stack.pop_back();
    ++nodes;
    if (won(state)) return {Result::solved, nodes};
    if (nodes >= budget) return {Result::undetermined, nodes};

    auto children = children_of(state);
    for (auto& child : children) {
      if (visited.insert(state_hash(child)).second) stack.push_back(std::move(child));
    }
  }
  return {Result::unsolvable, nodes};
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

struct Options {
  std::optional<std::uint64_t> seed;
  bool generate_pool = false;
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
      if (options.output.empty()) throw std::invalid_argument("--out is required with --genpool");
      std::vector<std::uint64_t> solved_seeds;
      std::uint64_t scanned = 0;
      const std::uint64_t batch_capacity = std::max<std::uint64_t>(options.jobs * 4, 16);
      while (scanned < options.count && solved_seeds.size() < options.limit) {
        const std::uint64_t batch_size = std::min(batch_capacity, options.count - scanned);
        std::vector<SearchResult> results(batch_size, {Result::undetermined, 0});
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
                results[local] = {Result::undetermined, options.budget};
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
    std::cout << result_name(search.result) << " seed=" << *options.seed
              << " nodes=" << search.nodes << " budget=" << options.budget << '\n';
    return search.result == Result::solved ? 0 : (search.result == Result::unsolvable ? 3 : 4);
  } catch (const std::exception& error) {
    std::cerr << "error: " << error.what() << '\n';
    return 1;
  }
}
