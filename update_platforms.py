import re

with open('data.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'id: "claude.*?(platforms: \[\])', lambda m: m.group(0).replace('platforms: []', 'platforms: [{"name": "AWS Bedrock", "regions": ["us-east-1", "us-west-2"]}, {"name": "GCP Vertex AI", "regions": ["us-central1"]}, {"name": "Anthropic API"}]'), content, flags=re.DOTALL)

content = re.sub(r'id: "gpt.*?(platforms: \[\])', lambda m: m.group(0).replace('platforms: []', 'platforms: [{"name": "Azure OpenAI", "regions": ["eastus", "southcentralus"]}, {"name": "OpenAI API"}]'), content, flags=re.DOTALL)

content = re.sub(r'id: "o(1|3).*?(platforms: \[\])', lambda m: m.group(0).replace('platforms: []', 'platforms: [{"name": "Azure OpenAI", "regions": ["eastus"]}, {"name": "OpenAI API"}]'), content, flags=re.DOTALL)

content = re.sub(r'id: "gemini.*?(platforms: \[\])', lambda m: m.group(0).replace('platforms: []', 'platforms: [{"name": "GCP Vertex AI", "regions": ["us-central1", "europe-west4"]}, {"name": "Google AI Studio"}]'), content, flags=re.DOTALL)

content = re.sub(r'id: "llama.*?(platforms: \[\])', lambda m: m.group(0).replace('platforms: []', 'platforms: [{"name": "AWS Bedrock", "regions": ["us-east-1", "us-west-2"]}, {"name": "Azure AI", "regions": ["eastus2"]}, {"name": "Together AI"}]'), content, flags=re.DOTALL)

content = re.sub(r'id: "mistral.*?(platforms: \[\])', lambda m: m.group(0).replace('platforms: []', 'platforms: [{"name": "AWS Bedrock", "regions": ["us-east-1"]}, {"name": "Mistral Platform"}]'), content, flags=re.DOTALL)

content = content.replace('platforms: []', 'platforms: [{"name": "OpenRouter"}]')

with open('data.js', 'w', encoding='utf-8') as f:
    f.write(content)
