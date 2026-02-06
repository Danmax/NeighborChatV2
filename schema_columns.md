# Schema Columns (Live DB)

Generated from live Supabase `information_schema.columns`.

## ai_generation_requests

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| membership_id | text | YES |
| request_type | text | NO |
| prompt | text | NO |
| parameters | jsonb | YES |
| status | text | YES |
| result | jsonb | YES |
| error_message | text | YES |
| model_used | text | YES |
| tokens_used | integer | YES |
| created_template_id | text | YES |
| created_at | timestamp with time zone | YES |
| completed_at | timestamp with time zone | YES |

## app_settings

| Column | Type | Nullable |
| --- | --- | --- |
| key | text | NO |
| value | jsonb | NO |
| updated_by | uuid | YES |
| updated_at | timestamp with time zone | YES |

## audit_logs

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| user_id | uuid | YES |
| instance_id | text | YES |
| action | text | NO |
| table_name | text | NO |
| record_id | text | YES |
| old_data | jsonb | YES |
| new_data | jsonb | YES |
| ip_address | text | YES |
| user_agent | text | YES |
| created_at | timestamp with time zone | YES |

## award_types

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| name | text | NO |
| description | text | YES |
| icon | text | YES |
| badge_image_url | text | YES |
| category | text | YES |
| criteria | jsonb | YES |
| rarity | text | YES |
| points_value | integer | YES |
| max_per_person | integer | YES |
| max_per_period | text | YES |
| is_active | boolean | YES |
| created_at | timestamp with time zone | YES |

## awards

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| award_type_id | text | YES |
| instance_id | text | YES |
| recipient_membership_id | text | YES |
| reason | text | YES |
| related_event_id | text | YES |
| related_game_session_id | text | YES |
| related_season_id | text | YES |
| given_by_membership_id | text | YES |
| nomination_id | text | YES |
| awarded_at | timestamp with time zone | YES |

## celebrations

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| type | text | NO |
| message | text | NO |
| honoree | text | YES |
| recipient_name | text | YES |
| recipient_id | text | YES |
| author_id | uuid | YES |
| author_name | text | NO |
| timestamp_ms | bigint | NO |
| emoji | text | YES |
| created_at | timestamp with time zone | YES |
| reactions | jsonb | YES |
| comments | jsonb | YES |
| visibility | text | YES |
| archived | boolean | YES |
| gif_url | text | YES |
| celebration_date | date | YES |
| image_url | text | YES |

## chat_messages

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| session_id | text | YES |
| channel | text | YES |
| category | text | YES |
| sender_membership_id | text | YES |
| sender_name | text | YES |
| sender_avatar | jsonb | YES |
| message_type | text | YES |
| content | text | YES |
| gif_url | text | YES |
| game_session_id | text | YES |
| created_at | timestamp with time zone | YES |

## chat_sessions

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| participant1_membership_id | text | YES |
| participant2_membership_id | text | YES |
| started_at | timestamp with time zone | YES |
| ended_at | timestamp with time zone | YES |
| duration_minutes | integer | YES |
| status | text | YES |
| created_at | timestamp with time zone | YES |

## community_events

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| type | text | NO |
| name | text | NO |
| date | timestamp with time zone | NO |
| location | text | YES |
| description | text | YES |
| created_by | text | NO |
| created_by_id | uuid | YES |
| created_at | timestamp with time zone | YES |
| participants | ARRAY | YES |
| visibility | text | YES |
| archived | boolean | YES |
| event_data | jsonb | YES |
| status | text | YES |
| capacity | integer | YES |
| join_policy | text | YES |
| meeting_link | text | YES |
| settings | jsonb | YES |
| updated_at | timestamp with time zone | YES |

## community_instances

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| name | text | NO |
| description | text | YES |
| logo | text | YES |
| banner_url | text | YES |
| instance_type | text | YES |
| settings | jsonb | YES |
| enabled_features | jsonb | YES |
| admin_ids | jsonb | YES |
| moderator_ids | jsonb | YES |
| invite_code | text | YES |
| is_public | boolean | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## event_chat_messages

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| event_id | text | NO |
| user_id | uuid | NO |
| membership_id | text | YES |
| body | text | NO |
| message_type | text | NO |
| metadata | jsonb | NO |
| created_at | timestamp with time zone | YES |

## event_manager_requests

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| user_id | text | NO |
| status | text | NO |
| reason | text | YES |
| reviewed_by | uuid | YES |
| reviewed_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## event_participants

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| event_id | text | YES |
| membership_id | text | YES |
| status | text | YES |
| role | text | YES |
| registered_at | timestamp with time zone | YES |
| checked_in_at | timestamp with time zone | YES |
| feedback_rating | integer | YES |
| feedback_text | text | YES |
| rsvp_status | text | YES |
| guest_count | integer | YES |
| checked_in | boolean | YES |
| notes | text | YES |
| approval_status | text | YES |
| updated_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | YES |

## events

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| name | text | NO |
| description | text | YES |
| event_type | text | YES |
| category | text | YES |
| start_datetime | timestamp with time zone | NO |
| end_datetime | timestamp with time zone | YES |
| timezone | text | YES |
| is_all_day | boolean | YES |
| recurrence_rule | text | YES |
| parent_event_id | text | YES |
| location_type | text | YES |
| location_name | text | YES |
| location_address | text | YES |
| virtual_link | text | YES |
| max_participants | integer | YES |
| waitlist_enabled | boolean | YES |
| registration_required | boolean | YES |
| registration_deadline | timestamp with time zone | YES |
| registration_fee | numeric | YES |
| linked_game_sessions | jsonb | YES |
| cover_image_url | text | YES |
| attachments | jsonb | YES |
| status | text | YES |
| visibility | text | YES |
| created_by_membership_id | text | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## favorite_movies

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| user_id | uuid | NO |
| movie_id | text | NO |
| source | text | NO |
| title | text | NO |
| poster_url | text | YES |
| year | integer | YES |
| created_at | timestamp with time zone | YES |

## feedback

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| user_id | uuid | NO |
| username | text | YES |
| category | text | NO |
| title | text | YES |
| message | text | NO |
| status | text | NO |
| metadata | jsonb | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## game_players

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| session_id | text | YES |
| membership_id | text | YES |
| status | text | YES |
| player_state | jsonb | YES |
| final_score | integer | YES |
| final_rank | integer | YES |
| points_earned | integer | YES |
| joined_at | timestamp with time zone | YES |
| finished_at | timestamp with time zone | YES |

## game_sessions

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| template_id | text | YES |
| season_id | text | YES |
| name | text | NO |
| description | text | YES |
| scheduled_start | timestamp with time zone | YES |
| actual_start | timestamp with time zone | YES |
| ended_at | timestamp with time zone | YES |
| status | text | YES |
| game_state | jsonb | YES |
| settings | jsonb | YES |
| host_membership_id | text | YES |
| results | jsonb | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## game_stats

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| membership_id | text | YES |
| game_type | text | NO |
| games_played | integer | YES |
| games_won | integer | YES |
| total_score | bigint | YES |
| best_score | integer | YES |
| average_score | numeric | YES |
| current_win_streak | integer | YES |
| best_win_streak | integer | YES |
| detailed_stats | jsonb | YES |
| updated_at | timestamp with time zone | YES |

## game_templates

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| name | text | NO |
| description | text | YES |
| icon | text | YES |
| cover_image_url | text | YES |
| game_type | text | NO |
| category | text | YES |
| config | jsonb | YES |
| rules | jsonb | YES |
| min_players | integer | YES |
| max_players | integer | YES |
| estimated_duration_minutes | integer | YES |
| ai_generated | boolean | YES |
| ai_prompt | text | YES |
| ai_model | text | YES |
| is_template | boolean | YES |
| is_public | boolean | YES |
| use_count | integer | YES |
| created_by_membership_id | text | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## gift_exchange_matches

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| event_id | text | NO |
| giver_user_id | uuid | NO |
| receiver_user_id | uuid | NO |
| status | text | NO |
| created_at | timestamp with time zone | YES |

## gift_exchange_wishlist_items

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| event_id | text | NO |
| user_id | uuid | NO |
| title | text | NO |
| description | text | YES |
| url | text | YES |
| price_range | text | YES |
| created_at | timestamp with time zone | YES |

## gift_exchange_wishlist_templates

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| user_id | uuid | NO |
| title | text | NO |
| description | text | YES |
| url | text | YES |
| price_range | text | YES |
| created_at | timestamp with time zone | YES |

## instance_memberships

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| user_id | uuid | YES |
| instance_id | text | YES |
| display_name | text | NO |
| avatar | jsonb | YES |
| shared_interests | jsonb | YES |
| privacy_settings | jsonb | YES |
| shared_location | text | YES |
| role | text | YES |
| status | text | YES |
| instance_points | integer | YES |
| instance_level | integer | YES |
| badges | jsonb | YES |
| joined_at | timestamp with time zone | YES |
| last_active_at | timestamp with time zone | YES |

## interest_options

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| label | text | NO |
| emoji | text | YES |
| sort_order | integer | YES |
| active | boolean | YES |

## knowledge_articles

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| category_id | text | YES |
| title | text | NO |
| slug | text | YES |
| summary | text | YES |
| content | text | YES |
| cover_image_url | text | YES |
| attachments | jsonb | YES |
| tags | jsonb | YES |
| difficulty_level | text | YES |
| estimated_read_time | integer | YES |
| author_membership_id | text | YES |
| status | text | YES |
| published_at | timestamp with time zone | YES |
| view_count | integer | YES |
| helpful_count | integer | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## knowledge_categories

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| name | text | NO |
| description | text | YES |
| icon | text | YES |
| parent_category_id | text | YES |
| sort_order | integer | YES |
| is_active | boolean | YES |
| created_at | timestamp with time zone | YES |

## master_profiles

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| full_name | text | YES |
| email | text | YES |
| phone | text | YES |
| linkedin | text | YES |
| birthday | date | YES |
| bio | text | YES |
| photo_url | text | YES |
| address | text | YES |
| city | text | YES |
| all_interests | jsonb | YES |
| skills | jsonb | YES |
| total_points | integer | YES |
| total_games_played | integer | YES |
| total_wins | integer | YES |
| achievements | jsonb | YES |
| default_avatar | jsonb | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## message_reactions

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| message_id | uuid | NO |
| user_id | uuid | NO |
| emoji | text | NO |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## messages

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| sender_id | uuid | NO |
| recipient_id | uuid | NO |
| message_type | text | YES |
| subject | text | YES |
| body | text | NO |
| read | boolean | YES |
| created_at | timestamp with time zone | YES |
| read_at | timestamp with time zone | YES |
| metadata | jsonb | YES |

## movie_cache

| Column | Type | Nullable |
| --- | --- | --- |
| cache_key | text | NO |
| data | jsonb | NO |
| expires_at | timestamp with time zone | NO |
| created_at | timestamp with time zone | YES |

## notifications

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| user_id | uuid | NO |
| type | text | NO |
| title | text | NO |
| message | text | NO |
| read | boolean | YES |
| link | text | YES |
| metadata | jsonb | YES |
| created_at | timestamp with time zone | YES |

## prizes

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| name | text | NO |
| description | text | YES |
| image_url | text | YES |
| value_type | text | YES |
| value_amount | numeric | YES |
| sponsor_id | text | YES |
| event_id | text | YES |
| season_id | text | YES |
| game_session_id | text | YES |
| winner_membership_id | text | YES |
| awarded_at | timestamp with time zone | YES |
| claimed_at | timestamp with time zone | YES |
| status | text | YES |
| created_at | timestamp with time zone | YES |

## public_profiles

| Column | Type | Nullable |
| --- | --- | --- |
| user_id | text | YES |
| display_name | text | YES |
| username | text | YES |
| avatar | jsonb | YES |
| bio | text | YES |
| banner_color | character varying | YES |
| banner_pattern | character varying | YES |
| banner_image_url | text | YES |
| interests | jsonb | YES |
| city | text | YES |
| phone | text | YES |
| birthday | date | YES |
| created_at | timestamp with time zone | YES |

## rate_limits

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| user_id | uuid | YES |
| action_type | text | NO |
| instance_id | text | YES |
| attempt_count | integer | YES |
| window_start | timestamp with time zone | YES |
| created_at | timestamp with time zone | YES |

## recipes

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| created_by_id | uuid | NO |
| title | text | NO |
| description | text | YES |
| ingredients | jsonb | YES |
| instructions | text | YES |
| prep_time | integer | YES |
| cook_time | integer | YES |
| servings | integer | YES |
| tags | ARRAY | YES |
| image_url | text | YES |
| is_public | boolean | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## saved_contacts

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| owner_id | text | NO |
| contact_user_id | text | YES |
| contact_name | text | YES |
| contact_avatar | jsonb | YES |
| contact_interests | jsonb | YES |
| notes | text | YES |
| created_at | timestamp with time zone | YES |
| favorite | boolean | YES |

## seasons

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| name | text | NO |
| description | text | YES |
| start_date | date | NO |
| end_date | date | NO |
| status | text | YES |
| scoring_rules | jsonb | YES |
| prizes | jsonb | YES |
| final_standings | jsonb | YES |
| champion_membership_id | text | YES |
| created_by_membership_id | text | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## speakers

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| created_by_id | uuid | NO |
| name | text | NO |
| title | text | YES |
| company | text | YES |
| bio | text | YES |
| headshot_url | text | YES |
| email | text | YES |
| social_links | jsonb | YES |
| is_public | boolean | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## sponsors

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| name | text | NO |
| description | text | YES |
| logo_url | text | YES |
| website_url | text | YES |
| contact_name | text | YES |
| contact_email | text | YES |
| tier | text | YES |
| start_date | date | YES |
| end_date | date | YES |
| is_active | boolean | YES |
| sponsored_items | jsonb | YES |
| created_at | timestamp with time zone | YES |

## status_options

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| label | text | NO |
| color | text | NO |
| sort_order | integer | YES |
| active | boolean | YES |

## training_paths

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| instance_id | text | YES |
| name | text | NO |
| description | text | YES |
| icon | text | YES |
| items | jsonb | YES |
| completion_award_type_id | text | YES |
| completion_points | integer | YES |
| estimated_hours | numeric | YES |
| difficulty_level | text | YES |
| is_active | boolean | YES |
| created_at | timestamp with time zone | YES |

## training_progress

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| membership_id | text | YES |
| path_id | text | YES |
| completed_items | jsonb | YES |
| current_item_index | integer | YES |
| status | text | YES |
| started_at | timestamp with time zone | YES |
| completed_at | timestamp with time zone | YES |
| total_score | integer | YES |

## user_profiles

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| user_id | text | YES |
| display_name | text | YES |
| real_name | text | YES |
| email | text | YES |
| phone | text | YES |
| location | text | YES |
| birthday | date | YES |
| title | text | YES |
| linkedin | text | YES |
| profile_image_url | text | YES |
| interests | jsonb | YES |
| avatar | jsonb | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |
| city | text | YES |
| magic_email | text | YES |
| onboarding_completed | boolean | YES |
| first_login_at | timestamp with time zone | YES |
| created_from_guest | boolean | YES |
| previous_guest_id | text | YES |
| username | text | YES |
| bio | text | YES |
| banner_color | character varying | YES |
| banner_pattern | character varying | YES |
| show_city | boolean | YES |
| show_phone | boolean | YES |
| show_email | boolean | YES |
| show_birthday | boolean | YES |
| show_interests | boolean | YES |
| role | text | YES |
| banner_image_url | text | YES |
| clerk_user_id | text | YES |

## workshops

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| event_id | text | YES |
| instance_id | text | YES |
| title | text | NO |
| description | text | YES |
| skill_level | text | YES |
| topics | jsonb | YES |
| learning_objectives | jsonb | YES |
| prerequisites | jsonb | YES |
| materials | jsonb | YES |
| instructor_membership_id | text | YES |
| instructor_name | text | YES |
| instructor_bio | text | YES |
| completion_criteria | jsonb | YES |
| certificate_template_id | text | YES |
| created_at | timestamp with time zone | YES |
