# Yandex monetization setup

Enable purchases and advertising for the game in the Yandex Games Developer Console.

| Product ID | Type | In-game result | Recommended launch price |
| --- | --- | --- | --- |
| `coins_500` | Consumable | 500 coins | 39 Yan |
| `coins_1500` | Consumable | 1500 coins | 89 Yan |
| `coins_theme_bundle` | Consumable | 300 × current released paid-theme count (2400 now) | 129 Yan |
| `remove_ads` | Non-consumable | Disables game-triggered interstitials | 99 Yan |

The UI reads the actual user-facing price, currency code, and currency icon from `payments.getCatalog()`. The values above are Developer Console guidance only and are not hard-coded into runtime UI.

Rewarded advertising grants 25 coins and is limited by the game to five successful rewards per trusted Yandex server day. A reward is granted only after the Yandex SDK fires `onRewarded`.

Game-triggered fullscreen advertising is requested only before a fresh Standard deal. It is not requested for Daily retries, same-deal restarts, menu navigation, settings, or store navigation. The `remove_ads` entitlement disables these game-triggered fullscreen requests permanently; voluntary rewarded ads remain available.

No sticky/banner advertising is used.

## Before release

1. Create all four products with the exact IDs above.
2. Enable advertising and in-app purchases for the game.
3. Open the Yandex debug panel and test each consumable purchase through purchase, credit, durable save, consume, and reload.
4. Leave at least one consumable purchase unconsumed during testing, reload, and verify startup reconciliation credits it exactly once and then consumes it.
5. Buy `remove_ads`, reload, and verify Standard fresh-deal interstitials stop while rewarded video still works.
6. Verify a rewarded video that is closed without `onRewarded` grants no coins.
7. Verify startup/platform advertising pauses audio and gameplay through `game_api_pause` / `game_api_resume`.
8. Verify no sticky/banner ad placement is enabled in the game UI.
9. Verify the store displays the SDK-provided price/currency/icon for every configured product instead of local price strings.
