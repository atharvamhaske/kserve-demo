package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
)

func main() {
	apiKey := os.Getenv("OPENAI_API_KEY")
	baseURL := os.Getenv("OPENAI_BASE_URL")
	model := os.Getenv("OPENAI_MODEL")
	if apiKey == "" || baseURL == "" || model == "" {
		log.Fatal("OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_MODEL must be set")
	}

	client := openai.NewClient(
		option.WithAPIKey(apiKey),
		option.WithBaseURL(baseURL),
	)

	completion, err := client.Chat.Completions.New(
		context.Background(),
		openai.ChatCompletionNewParams{
			Messages: []openai.ChatCompletionMessageParamUnion{
				openai.UserMessage("Say hello from the GPU model in one sentence."),
			},
			Model: openai.ChatModel(model),
		},
	)
	if err != nil {
		log.Fatalf("create chat completion: %v", err)
	}
	if len(completion.Choices) == 0 {
		log.Fatal("chat completion returned no choices")
	}

	fmt.Println(completion.Choices[0].Message.Content)
}
