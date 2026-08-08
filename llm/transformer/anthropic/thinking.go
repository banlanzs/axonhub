package anthropic

import (
	"strings"

	"github.com/looplj/axonhub/llm"
)

// isDeepSeekModel reports whether a model name identifies a DeepSeek model.
// Third-party relays expose DeepSeek behind an Anthropic-format endpoint, so the
// model name is the only reliable signal available on such channels.
func isDeepSeekModel(model string) bool {
	return strings.Contains(strings.ToLower(model), "deepseek")
}

// resolveEffectivePlatform upgrades a generic Anthropic-compatible platform to
// PlatformDeepSeek when the requested model is a DeepSeek model.
//
// A channel configured as plain Anthropic or Claude Code may point at a relay
// that forwards DeepSeek models. The channel type alone cannot tell us the
// upstream enforces DeepSeek's stricter thinking rules (every assistant message
// must carry a signed thinking block, and thinking.type=adaptive is rejected),
// so we derive it from the model. Platforms that cannot serve DeepSeek models
// (Bedrock, Vertex) and platforms already carrying an explicit provider type are
// left untouched.
func resolveEffectivePlatform(chatReq *llm.Request, config *Config) *Config {
	if config == nil || !isDeepSeekModel(chatReq.Model) {
		return config
	}

	//nolint:exhaustive // Only generic Anthropic platforms are upgraded.
	switch config.Type {
	case "", PlatformDirect, PlatformClaudeCode:
		clone := *config
		clone.Type = PlatformDeepSeek

		return &clone
	default:
		return config
	}
}

// isDeepSeekPlatformOrModel returns true when the platform is explicitly
// DeepSeek or the model name identifies a DeepSeek model. This covers
// both native DeepSeek channels and generic Anthropic channels (Direct,
// Claude Code) that proxy to a DeepSeek relay.
func isDeepSeekPlatformOrModel(model string, config *Config) bool {
	if config != nil {
		switch config.Type {
		case PlatformDeepSeek:
			return true
		case "", PlatformDirect, PlatformClaudeCode:
			return isDeepSeekModel(model)
		}
	}

	return isDeepSeekModel(model)
}

func supportsAdaptiveThinking(config *Config) bool {
	if config == nil {
		return true
	}

	//nolint:exhaustive // Checked.
	switch config.Type {
	case PlatformDirect, PlatformClaudeCode, PlatformBedrock, PlatformVertex:
		return true
	default:
		return false
	}
}

// supportsOutputConfig returns true if the platform supports the output_config field
// with effort control. DeepSeek supports output_config.effort but does NOT support
// thinking.type = "adaptive".
func supportsOutputConfig(config *Config) bool {
	if config == nil {
		return true
	}

	//nolint:exhaustive // Checked.
	switch config.Type {
	case PlatformDirect, PlatformClaudeCode, PlatformBedrock, PlatformVertex, PlatformDeepSeek:
		return true
	default:
		return false
	}
}

// thinkingBudgetToReasoningEffort converts thinking budget tokens to reasoning effort string.
func thinkingBudgetToReasoningEffort(budgetTokens int64) string {
	// Map budget tokens to reasoning effort based on the same logic used in outbound
	if budgetTokens <= 5000 {
		return "low"
	} else if budgetTokens <= 15000 {
		return "medium"
	} else {
		return "high"
	}
}

// getDefaultReasoningEffortMapping returns the default mapping from ReasoningEffort to thinking budget tokens.
var defaultReasoningEffortMapping = map[string]int64{
	"low":    5000,
	"medium": 15000,
	"high":   30000,
	"xhigh":  30000,
	"max":    30000,
}

// getThinkingBudgetTokensWithConfig returns the thinking budget tokens for a given reasoning effort with config.
func getThinkingBudgetTokensWithConfig(reasoningEffort string, config *Config) int64 {
	if config != nil && config.ReasoningEffortToBudget != nil {
		if budget, exists := config.ReasoningEffortToBudget[reasoningEffort]; exists {
			return budget
		}
	}

	// Fall back to default mapping
	if budget, exists := defaultReasoningEffortMapping[reasoningEffort]; exists {
		return budget
	}

	// Default to medium if not found
	return 15000
}
