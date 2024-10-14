#!/usr/bin/env python3

import os
from pydub import AudioSegment
import numpy as np

# python -m venv python-for-bitw
# source ./python-for-bitw/bin/activate
# pip install numpy pydub audioread

# Path to the directory containing audio files
directory_path = './weather-playlist'

# Target loudness in dBFS (decibels relative to full scale)
target_dBFS = -20.0

# Function to calculate loudness (in decibels) of an audio segment
def calculate_loudness(audio_segment):
    samples = np.array(audio_segment.get_array_of_samples())
    rms = np.sqrt(np.mean(samples**2))
    return 20 * np.log10(rms)

# Function to normalize audio loudness
def normalize_loudness(audio_segment, target_dBFS):
    change_in_dBFS = target_dBFS - audio_segment.dBFS
    return audio_segment.apply_gain(change_in_dBFS)

# Process all MP3 files in the directory
def process_directory():
    for filename in os.listdir(directory_path):
        if filename.endswith('.mp3'):
            file_path = os.path.join(directory_path, filename)
            print(f"Processing file: {file_path}")
            
            # Load the MP3 file using Pydub
            audio = AudioSegment.from_mp3(file_path)
            
            # Calculate the original loudness
            print(f"Original Loudness (dBFS): {audio.dBFS:.2f}")
            
            # Normalize loudness
            normalized_audio = normalize_loudness(audio, target_dBFS)
            
            # Save the normalized audio to a new file
            normalized_file_path = os.path.join(directory_path, f"normalized_{filename}")
            normalized_audio.export(normalized_file_path, format="mp3")
            print(f"Normalized file saved to: {normalized_file_path}")
            print(f"New Loudness (dBFS): {normalized_audio.dBFS:.2f}")
        else:
            print(f"Skipping non-MP3 file: {filename}")

# Call the function to process the audio directory
process_directory()

